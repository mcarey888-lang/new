/** Exact indexed import for the reused planner; review drafts are never surveyed. */
export function reviewEditorScript() {
  return `
function loadReviewDraft(msg) {
  if (msg.type !== "loadReviewDraft") return false;
  var geom = msg.points, ix = msg.anchorIndices;
  if (!Array.isArray(geom) || geom.length < 2 || geom.length > 20000 ||
      !geom.every(function(p) { return p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lng) && Math.abs(p.lng)<=180; }) ||
      !Array.isArray(ix) || ix.length < 2 || ix.length > 200 ||
      ix[0] !== 0 || ix[ix.length-1] !== geom.length-1 ||
      !ix.every(function(n,i) { return Number.isInteger(n) && n>=0 && n<geom.length && (!i || n>ix[i-1]); })) return true;
  if (typeof clearSummitDestination === "function") clearSummitDestination();
  if (typeof hideSummitCard === "function") hideSummitCard();
  flying = false; setDrawing(false); profileToken++;
  anchors = ix.map(function(n) { return {lat:geom[n].lat,lng:geom[n].lng}; });
  legs = ix.slice(1).map(function(n,i) {
    return {kind:"offPath",points:geom.slice(ix[i],n+1),lengthM:null};
  });
  redraw(); emit(); fitSavedRoute(geom);
  post({type:"routeLoaded",name:"Review draft"});
  return true;
}
`;
}
