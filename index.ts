// @ts-nocheck — async bootstrap intentionally uses dynamic import
/**
 * 入口
 *
 * 关键：必须在 import App 之前把 global.CanvasKit 设上。
 * 原因：@shopify/react-native-skia 2.6.2 的 web 版在模块顶层执行
 *   `export const Skia = JsiSkApi(global.CanvasKit)`
 * 模块加载完成后 `Skia` 单例就固定了，运行时再 await LoadSkiaWeb 救不回来。
 * 所以这里先 await CanvasKitInit（设上 global.CanvasKit），再 dynamic import App。
 *
 * 流程：
 *   1. 同步 import expo / canvaskit-wasm
 *   2. patch CSSStyleSheet.insertRule（兜底 Tauri WebView2 下 insertRule 静默失败）
 *   3. async  await CanvasKitInit，set global.CanvasKit
 *   4. dynamic import App（此时 skia 模块的顶层求值拿到的是设好的 CanvasKit）
 *   5. registerRootComponent(App)
 */
import { registerRootComponent } from 'expo';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import CanvasKitInit from 'canvaskit-wasm/bin/full/canvaskit';

/**
 * Tauri Windows WebView2 (Edge Chromium) 下 CSSStyleSheet.insertRule 静默失败。
 * react-native-web 把 flex / position / display 这些布局属性全部编成 atomic class
 * 通过 insertRule 注入 stylesheet —— insertRule 失败 → className 在元素上但 CSS 规则没进 stylesheet
 * → 整个 app 布局退化到 block 流式竖排（用户截图症状："中"按钮横铺全宽 / 底部 tab 只剩 1 个图标）。
 *
 * 兜底方案：在原始 insertRule 上包一层，如果抛错就把 cssText 同步写到 ownerNode.textContent，
 * 这样 <style> 元素的 standard textContent 路径就能让浏览器正常解析 CSS。
 */
function patchInsertRule() {
  if (typeof CSSStyleSheet === 'undefined') return;
  const proto = CSSStyleSheet.prototype;
  if ((proto as any).__rnWebTauriPatched) return;
  (proto as any).__rnWebTauriPatched = true;

  const origInsert = proto.insertRule;
  proto.insertRule = function patchedInsertRule(rule: string, index?: number): number {
    try {
      return origInsert.call(this, rule, index);
    } catch (e) {
      // insertRule 失败（Edge/Tauri CSP 或其他限制）→ 写到 <style> 元素的 textContent 兜底
      const ownerNode = (this as any).ownerNode as HTMLElement | null;
      if (ownerNode && ownerNode.tagName === 'STYLE') {
        const existing = ownerNode.textContent || '';
        const sep = existing && !existing.endsWith('\n') ? '\n' : '';
        ownerNode.textContent = existing + sep + rule;
      }
      return -1;
    }
  };

  // deleteRule / insertRule 也会被 RN-Web 用到，deleteRule 失败一般不影响布局，跳过
}

patchInsertRule();

async function bootstrap() {
  try {
    const CanvasKit = await CanvasKitInit({
      // 指向 public/canvaskit.wasm（Expo dev server / prod build 都从 / 静态服务）
      locateFile: () => '/canvaskit.wasm',
    });
    // canvaskit 暴露在 global 上，skia web 实现会从这里读
    (globalThis as any).CanvasKit = CanvasKit;
    console.info('[index] CanvasKit ready, version:', CanvasKit?.version?.() ?? 'unknown');
  } catch (e) {
    console.warn('[index] CanvasKit init failed', e);
  }

  const { default: App } = await import('./App');
  registerRootComponent(App);
}

bootstrap();
