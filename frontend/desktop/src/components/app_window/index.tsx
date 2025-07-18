/* eslint-disable jsx-a11y/alt-text */
import useAppStore from '@/stores/app';
import { Box, Flex, Image, Text } from '@chakra-ui/react';
import clsx from 'clsx';
import React, { useRef, useState } from 'react';
import Draggable, { DraggableEventHandler } from 'react-draggable';
import styles from './index.module.scss';
import { useTranslation } from 'next-i18next';
import { useConfigStore } from '@/stores/config';

export default function AppWindow(props: {
  style?: React.CSSProperties;
  pid: number;
  children: any;
}) {
  const { pid } = props;
  const {
    closeAppById,
    updateOpenedAppInfo,
    setToHighestLayerById,
    currentApp,
    currentAppPid,
    findAppInfoById,
    maxZIndex
  } = useAppStore();
  const logo = useConfigStore().layoutConfig?.logo;
  const { t, i18n } = useTranslation();
  const wnapp = findAppInfoById(pid);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragDom = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  if (!wnapp) return null;

  const handleDragBoundary: DraggableEventHandler = (e, position) => {
    const { x, y } = position;
    const desktopHeight = document.getElementById('desktop')?.clientHeight;
    if (!desktopHeight) {
      setPosition({ x: 0, y: 0 });
      return;
    }
    const appHeaderHeight = dragDom.current?.querySelector('.windowHeader')?.clientHeight || 30;
    const appHeaderWidth = dragDom.current?.querySelector('.windowHeader')?.clientWidth || 3000;

    if (currentApp()?.size === 'maxmin') {
      let upperBoundary = -desktopHeight * 0.1;
      let lowerBoundary = desktopHeight * 0.9 - appHeaderHeight;
      setPosition({
        x:
          x < 0
            ? x < -0.9 * appHeaderWidth // (0.8width + width/0.70*0.15)
              ? 0
              : x
            : x > 0.9 * appHeaderWidth
            ? 0
            : x,
        y: y < upperBoundary ? upperBoundary : y > lowerBoundary ? 0 : y
      });
    } else {
      setPosition({
        x: x < 0 ? (x < -0.8 * appHeaderWidth ? 0 : x) : x > 0.8 * appHeaderWidth ? 0 : x,
        y: y < 0 ? 0 : y > desktopHeight - appHeaderHeight ? 0 : y
      });
    }
  };

  const handleMinimize = () => {
    updateOpenedAppInfo({
      ...wnapp,
      size: 'minimize',
      cacheSize: wnapp.size
    });
  };

  const handleMaximizeRestore = () => {
    setPosition({ x: 0, y: 0 });
    updateOpenedAppInfo({
      ...wnapp,
      size: wnapp?.size === 'maxmin' ? 'maximize' : 'maxmin',
      cacheSize: wnapp?.size === 'maxmin' ? 'maximize' : 'maxmin'
    });
  };

  const handleClose = () => {
    updateOpenedAppInfo({
      ...wnapp,
      isShow: false
    });
    closeAppById(currentAppPid);
  };

  return (
    <Draggable
      onStart={() => {
        setDragging(true);
      }}
      onDrag={(e, position) => {
        setPosition(position);
      }}
      onStop={(e, position) => {
        handleDragBoundary(e, position);
        setDragging(false);
      }}
      handle=".windowHeader"
      position={position}
    >
      <div
        ref={dragDom}
        className={clsx(styles.windowContainer, dragging ? styles.notrans : '')}
        data-size={wnapp?.size}
        data-hide={!wnapp?.isShow}
        id={wnapp?.icon + 'App'}
        style={{
          zIndex: wnapp?.zIndex
        }}
      >
        {/* app window header */}
        <Flex
          cursor={'pointer'}
          h="28px"
          background={'grayModern.100'}
          className={'windowHeader'}
          borderRadius={'6px 6px 0 0'}
          onClick={() => {
            setToHighestLayerById(pid);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <Flex ml="16px" alignItems={'center'} fontSize={'12px'} fontWeight={400}>
            <Image
              src={wnapp?.icon}
              fallbackSrc={logo}
              alt={wnapp?.name}
              width={'20px'}
              height={'20px'}
              borderRadius={'6px'}
            />
            <Box ml="8px" fontSize={'12px'} fontWeight={400}>
              {wnapp?.i18n?.[i18n?.language]?.name
                ? wnapp.i18n?.[i18n?.language]?.name
                : wnapp?.name}
            </Box>
            {wnapp?.menuData &&
              wnapp?.menuData?.length > 0 &&
              wnapp?.menuData?.map((item) => (
                <Text
                  key={item.name}
                  color={'#24282C'}
                  ml="16px"
                  onClick={() => {
                    typeof item?.link === 'string' && window.open(item?.link);
                  }}
                >
                  {item.name}
                </Text>
              ))}
          </Flex>
          <Flex ml={'auto'}>
            <Box
              className={styles.uicon}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleMinimize();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleMinimize();
              }}
            >
              <Image
                src="/icons/minimize.png"
                fallbackSrc={logo}
                alt={wnapp?.name}
                width={'12px'}
                height={'12px'}
              />
            </Box>
            <Box
              className={styles.uicon}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleMaximizeRestore();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleMaximizeRestore();
              }}
            >
              <Image
                src={wnapp.size === 'maximize' ? '/icons/maximize.png' : '/icons/maxmin.png'}
                fallbackSrc={logo}
                alt={wnapp?.name}
                width={'12px'}
                height={'12px'}
              />
            </Box>
            <Box
              className={clsx(styles.uicon)}
              data-type={'close'}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleClose();
              }}
              onTouchEnd={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleClose();
              }}
            >
              <Image
                src={'/icons/close.png'}
                fallbackSrc={logo}
                alt={wnapp?.name}
                width={'12px'}
                height={'12px'}
              />
            </Box>
          </Flex>
        </Flex>
        {/* app switch mask */}
        <div
          className={styles.appMask}
          onClick={() => {
            setToHighestLayerById(pid);
          }}
          style={{ pointerEvents: wnapp.zIndex !== maxZIndex ? 'unset' : 'none' }}
        ></div>
        {/* app window content */}
        <Flex flexGrow={1} overflow={'hidden'} borderRadius={'0 0 6px 6px'} position={'relative'}>
          {/* Drag necessary to improve fluency */}
          {dragging && (
            <Box
              position={'absolute'}
              w="100%"
              h="100%"
              background={'transparent'}
              zIndex={8888}
            ></Box>
          )}
          {props.children}
        </Flex>
      </div>
    </Draggable>
  );
}
