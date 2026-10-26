/**
 * Dated discovery evidence only. No geometry, canonical links or rights grants.
 * Requirements themselves are always derived live from challenge_stages.
 */
const lead = (id: number, name: string) => ({
  id, name, url: `https://www.openstreetmap.org/relation/${id}`,
  status: "unreviewed_source_lead",
});
const missing = "No complete, exact-variant reusable route geometry has been acquired.";
const sourceOnly = "Named source geometry is available, but full expedition start/finish, return leg and variant are not confirmed. No elevation profile is supplied.";
export const expeditionRouteSourcing = {
  generatedAt: "2026-10-26T12:40:40.166468+00:00",
  routes: {
    cmd: { sourceLeads: [lead(4004228, "Carn Mor Dearg arete")],
      blockers: [sourceOnly, "The acquired source chain is about 5.88 km, not the existing 18 km full Ben Nevis walk."] },
    cairngorm_macdui: { sourceLeads: [
      lead(16127605, "Cairn Gorm Trail"), lead(18066662, "Cairn Gorm & Sron a Cha-no Ridge"),
      lead(18085779, "Ben Macdui and Derry Cairngorm Trail")],
      blockers: [missing, "Derry Cairngorm is not Cairn Gorm; these leads must not be substituted for the required traverse."] },
    lochnagar: { sourceLeads: [lead(5649486, "Lochnagar & Loch Muick")],
      blockers: [missing, "The lead does not establish the full White Mounth circuit."] },
    watkin: { sourceLeads: [lead(4004198, "Watkin Path")],
      blockers: ["The linked out-and-back draft remains needs_review; source rights, access and terrain edition/profile attestations are still outstanding."] },
    aonach_eagach: { sourceLeads: [lead(16127354, "Aonoch Eagach Trail")],
      blockers: [sourceOnly, "Exact ridge variant, scrambling/exposure, direction and access need specialist review."] },
    fairfield: { sourceLeads: [], blockers: [missing] },
    tryfan_north: { sourceLeads: [], blockers: [missing, "The North Ridge scramble must not be replaced by an ordinary walking approach."] },
    an_teallach: { sourceLeads: [], blockers: [missing, "The exact exposed ridge variant and bypass choices must be explicit."] },
    braeriach: { sourceLeads: [lead(18081370, "Braeriach Trail")],
      blockers: [missing, "Rejected for import: this lead is only a 0.29 km fragment, not the 28 km Lairig Ghru approach."] },
    crib_goch: { sourceLeads: [lead(4499076, "Crib Goch")],
      blockers: [missing, "Automatic source-chain preparation rejected branched or non-open geometry; no artificial connections were added. Exact scramble direction and return need review."] },
    liathach: { sourceLeads: [lead(16155653, "Liathach Trail")],
      blockers: [missing, "Automatic source-chain preparation rejected branched or non-open geometry; exposed ridge and bypass choices need individual preparation."] },
    cruachan: { sourceLeads: [], blockers: [missing] },
    carneddau: { sourceLeads: [], blockers: [missing, "Cwm Idwal and Llyn Ogwen tourist circuits are not the required Carneddau traverse."] },
    helvellyn_edge: { sourceLeads: [], blockers: [missing, "The full route must include both Striding Edge and Swirral Edge, with explicit direction."] },
    scafell_corridor: { sourceLeads: [], blockers: [missing, "Hollow Stones is not the Corridor Route; no substitution was made."] },
    y3p: { sourceLeads: [], blockers: [missing, "Generic Three Peaks search results do not establish the Yorkshire circuit or its start and direction."] },
    bla_bheinn: { sourceLeads: [], blockers: [missing, "The South Ridge variant must be identified, not a nearby similarly named mountain."] },
    edale_skyline: { sourceLeads: [], blockers: [missing] },
    cautley: { sourceLeads: [], blockers: [missing] },
    beinn_alligin: { sourceLeads: [], blockers: [missing] },
    blencathra_sharp: { sourceLeads: [], blockers: [missing, "The full Sharp Edge scrambling variant needs explicit source geometry."] },
    great_gable: { sourceLeads: [], blockers: [missing] },
    high_street: { sourceLeads: [], blockers: [missing] },
    great_ridge: { sourceLeads: [], blockers: [missing, "Mam Tor tourist/cave loops do not establish the required Great Ridge route."] },
    pen_y_ghent: { sourceLeads: [], blockers: [missing] },
    whernside: { sourceLeads: [], blockers: [missing] },
    bleaklow: { sourceLeads: [], blockers: [missing] },
    cadair: { sourceLeads: [lead(1870230, "Minffordd Path")],
      blockers: [missing, "The named path lead still requires complete source-chain preparation and confirmation of the intended return."] },
    crinkles: { sourceLeads: [], blockers: [missing] },
    ingleborough: { sourceLeads: [], blockers: [missing] },
    glyders: { sourceLeads: [], blockers: [missing] },
    llanberis: { sourceLeads: [lead(4004181, "Llanberis Path")],
      blockers: [sourceOnly, "The acquired 6.03 km source chain is not the existing 14.5 km full expedition walk; no return or summit link was invented."] },
  },
};
