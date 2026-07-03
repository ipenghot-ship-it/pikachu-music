/**
 * ErrorBoundary — 捕获子组件树 render 异常，避免 Skia 等模块渲染失败导致整页黑屏
 *
 * 用法：
 *   <ErrorBoundary fallback={<View />}>
 *     <RiskySkiaComponent />
 *   </ErrorBoundary>
 */
import React from 'react';
import { View } from 'react-native';

interface Props {
  children: React.ReactNode;
  /** 出错时显示的 fallback（默认空 View，渲染失败就当它不存在） */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.warn('[ErrorBoundary]', error, info?.componentStack?.slice(0, 200));
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <View />;
    }
    return this.props.children;
  }
}