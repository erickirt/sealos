import { authSession } from '@/services/backend/auth';
import { getK8s } from '@/services/backend/kubernetes';
import { jsonRes } from '@/services/backend/response';
import { TemplateType } from '@/types/app';
import {
  getTemplateDataSource,
  handleTemplateToInstanceYaml,
  getYamlTemplate,
  parseTemplateVariable
} from '@/utils/json-yaml';
import fs from 'fs';
import JsYaml from 'js-yaml';
import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { replaceRawWithCDN } from './listTemplate';
import { getTemplateEnvs } from '@/utils/tools';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      templateName,
      locale = 'en',
      includeReadme = 'true'
    } = req.query as {
      templateName: string;
      locale: string;
      includeReadme: string;
    };

    let user_namespace = '';

    try {
      const { namespace } = await getK8s({
        kubeconfig: await authSession(req.headers)
      });
      user_namespace = namespace;
    } catch (error) {}

    const {
      code,
      message,
      dataSource,
      templateYaml,
      TemplateEnvs,
      appYaml,
      readmeContent,
      readUrl
    } = await GetTemplateByName({
      namespace: user_namespace,
      templateName: templateName,
      locale,
      includeReadme
    });

    if (code !== 20000) {
      return jsonRes(res, { code, message });
    }

    jsonRes(res, {
      code: 200,
      data: {
        source: {
          ...dataSource,
          ...TemplateEnvs
        },
        appYaml,
        templateYaml,
        readmeContent,
        readUrl
      }
    });
  } catch (err: any) {
    console.log(err);
    jsonRes(res, {
      code: 500,
      error: err
    });
  }
}

export async function GetTemplateByName({
  namespace,
  templateName,
  locale = 'en',
  includeReadme = 'true'
}: {
  namespace: string;
  templateName: string;
  locale?: string;
  includeReadme?: string;
}) {
  const cdnUrl = process.env.CDN_URL;
  const targetFolder = process.env.TEMPLATE_REPO_FOLDER || 'template';

  const TemplateEnvs = getTemplateEnvs(namespace);

  const originalPath = process.cwd();
  const targetPath = path.resolve(originalPath, 'templates', targetFolder);
  // Query by file name in template details
  const jsonPath = path.resolve(originalPath, 'templates.json');
  const jsonData: TemplateType[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const _tempalte = jsonData.find((item) => item.metadata.name === templateName);
  const _tempalteName = _tempalte ? _tempalte.spec.fileName : `${templateName}.yaml`;
  const yamlString = _tempalte?.spec?.filePath
    ? fs.readFileSync(_tempalte?.spec?.filePath, 'utf-8')
    : fs.readFileSync(`${targetPath}/${_tempalteName}`, 'utf-8');

  let { appYaml, templateYaml } = getYamlTemplate(yamlString);
  if (!templateYaml) {
    return {
      code: 40000,
      message: 'Lack of kind template'
    };
  }
  templateYaml.spec.deployCount = _tempalte?.spec?.deployCount;
  if (cdnUrl) {
    templateYaml.spec.readme = replaceRawWithCDN(templateYaml.spec.readme, cdnUrl);
    templateYaml.spec.icon = replaceRawWithCDN(templateYaml.spec.icon, cdnUrl);
    if (templateYaml?.spec?.i18n) {
      Object.keys(templateYaml?.spec?.i18n || {}).forEach((lang) => {
        const i18nLang = templateYaml?.spec?.i18n?.[lang];
        ['readme', 'icon'].forEach((field) => {
          if (i18nLang?.[field]) {
            i18nLang[field] = replaceRawWithCDN(i18nLang[field], cdnUrl);
          }
        });
      });
    }
  }

  templateYaml = parseTemplateVariable(templateYaml, TemplateEnvs);
  const dataSource = getTemplateDataSource(templateYaml);

  // Convert template to instance
  const instanceName = dataSource?.defaults?.['app_name']?.value;
  if (!instanceName) {
    return {
      code: 40000,
      message: 'default app_name is missing'
    };
  }
  const instanceYaml = handleTemplateToInstanceYaml(templateYaml, instanceName);
  appYaml = `${JsYaml.dump(instanceYaml)}\n---\n${appYaml}`;

  let readmeContent = '';
  let readUrl = '';

  if (includeReadme) {
    readUrl = templateYaml?.spec?.i18n?.[locale]?.readme || templateYaml?.spec?.readme || '';
    if (readUrl) {
      try {
        readmeContent = await fetchReadmeContentWithRetry(readUrl);
      } catch (error) {
        readmeContent = '';
      }
    }
  }

  return {
    code: 20000,
    message: 'success',
    dataSource,
    TemplateEnvs,
    appYaml,
    templateYaml,
    readmeContent,
    readUrl
  };
}

async function fetchReadmeContentWithRetry(url: string): Promise<string> {
  if (!url) return '';

  let retryCount = 0;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/markdown,text/plain,*/*',
          'Content-Type': 'text/markdown; charset=UTF-8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          'User-Agent': 'Mozilla/5.0'
        },
        credentials: 'omit'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.text();
    } catch (err) {
      retryCount++;
      if (retryCount === maxRetries) {
        console.log(`Failed to fetch README from ${url} after ${maxRetries} attempts`);
        return '';
      }
      await new Promise((resolve) => setTimeout(resolve, retryCount * 1000));
    }
  }
  return '';
}
