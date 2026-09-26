// The route (380 × 344) and artwork (406 × 366) share a left/bottom origin.
// Reserve room for the PNG's extra 26 units on the right and 22 above the route.
const ROUTE_WIDTH = 380;
const ROUTE_HEIGHT = 344;
const ARTWORK_WIDTH = 406;
const ARTWORK_TOP_BLEED = 22;

export const BASECAMP_AXIS_WIDTH = 49;
export const BASECAMP_MOUNTAIN_BOTTOM_SPACE = 17;

export function basecampMountainLayout(contentWidth: number) {
  const available = Math.max(0, contentWidth - BASECAMP_AXIS_WIDTH);
  const plotWidth = available * ROUTE_WIDTH / ARTWORK_WIDTH;
  const plotHeight = plotWidth * ROUTE_HEIGHT / ROUTE_WIDTH;
  const topSpace = plotWidth * ARTWORK_TOP_BLEED / ROUTE_WIDTH + 6;
  return {
    plotWidth,
    plotHeight,
    topSpace,
    totalHeight: topSpace + plotHeight + BASECAMP_MOUNTAIN_BOTTOM_SPACE,
  };
}