import { View, TViewParams, TUIMap, TUIElements, TUIEvents } from "bonsai";

import { PageModel } from "./Page.data";
import { pageViewTemplate } from "./pageView.template";

// #region UI
type TPageViewUI = TUIMap<{
  pageLogin: { sel: ".Page-login"; event: ["click"] };
  pageUnlogin: { sel: ".Page-unlogin"; event: ["click"] };
  headerRegion: { sel: "#header-region"; event: [] };
  footerRegion: { sel: "#footer-region"; event: [] };
  showHeader: { sel: ".Page-show-header"; event: ["click"] };
  hideHeader: { sel: ".Page-hide-header"; event: ["click"] };
}>;

type TPageViewUIRegions = Pick<
  TPageViewUI,
  "headerRegion" /*| "footerRegion"*/
>;

const pageUIRegions: TUIElements<TPageViewUIRegions> = {
  headerRegion: "#header-region"
  // footerRegion: "#footer-region"
} as const;

const pageUIElements: TUIElements<TPageViewUI> = {
  pageLogin: ".Page-login",
  pageUnlogin: ".Page-unlogin",
  headerRegion: "#header-region",
  footerRegion: "#footer-region",
  showHeader: ".Page-show-header",
  hideHeader: ".Page-hide-header"
} as const;
//#endregion

//#region UIEvents
const pageViewUIEvents: TUIEvents<TPageViewUI, PageView> = {
  "click @ui.showHeader": "onShowHeaderClick",
  "click @ui.hideHeader": "onHideHeaderClick"
} as const;
//#endregion

type TPageViewParams = TViewParams<
  PageView,
  {
    ui: TPageViewUI;
    options: { isOK: boolean };
    eventMap: { "test:event": () => {} };
    regions: TUIElements<TPageViewUIRegions>;
    model: PageModel;
  }
>;

export class PageView extends View<PageView, TPageViewParams> {
  get Element() {
    return "#page-view" as const;
  }
  get Template() {
    return pageViewTemplate;
  }

  get UIElements() {
    return pageUIElements;
  }
  get UIEvents() {
    return pageViewUIEvents;
  }
  get Regions() {
    return pageUIRegions;
  }
  onShowHeaderClick(event: MouseEvent) {
    console.log("Montres-moi le header !");
    // this.model.set({ hasHeader: true });
  }
  onHideHeaderClick(event: MouseEvent) {
    console.log("Caches-moi le header !");
    // this.model.set({ hasHeader: false });
  }
}
