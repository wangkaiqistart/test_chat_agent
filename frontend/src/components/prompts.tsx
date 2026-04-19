/**
 * 提示词快捷操作数据
 */
import React from 'react';
import {
  FileSearchOutlined,
  ProductOutlined,
  ScheduleOutlined,
  AppstoreAddOutlined,
} from '@ant-design/icons';

export interface PromptItem {
  key: string;
  description: string;
  icon?: React.ReactNode;
}

export const PROMPT_ITEMS: PromptItem[] = [
  {
    key: '1',
    description: '搜索最新资讯',
    icon: <FileSearchOutlined />,
  },
  {
    key: '2',
    description: '写一段代码',
    icon: <ProductOutlined />,
  },
  {
    key: '3',
    description: '解释概念',
    icon: <ScheduleOutlined />,
  },
  {
    key: '4',
    description: '其他问题',
    icon: <AppstoreAddOutlined />,
  },
];
