const canvas = document.querySelector("#globeCanvas");
const ctx = canvas.getContext("2d", { alpha: true });
const stage = document.querySelector(".globe-stage");

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  radius: 0,
  centerX: 0,
  centerY: 0,
  yaw: -0.48,
  pitch: -0.14,
  targetYaw: -0.48,
  targetPitch: -0.14,
  velocityX: 0,
  velocityY: 0,
  isDragging: false,
  pointerX: 0,
  pointerY: 0,
  intro: 0,
  dragDistance: 0,
  selectedBookId: null,
  selectedSiteIndex: 0,
};

const tilt = -Math.PI / 6;
let landRings = [];
let landReady = false;
function buildPinPoints(book) {
  if (book.sites && book.sites.length > 0) {
    return book.sites.map((site, siteIndex) => ({
      siteIndex,
      vector: sphericalToVector(site.lon, site.lat),
    }));
  }

  return [{ siteIndex: 0, vector: sphericalToVector(book.lon, book.lat) }];
}

const books = (window.ETHNOGRAPHY_BOOKS || []).map((book) => ({
  ...book,
  vector: sphericalToVector(book.lon, book.lat),
  pinPoints: buildPinPoints(book),
}));
let projectedPins = [];
let hoveredPinId = null;
const bookCard = document.querySelector("#bookCard");
const bookCardClose = document.querySelector("#bookCardClose");
const bookLocationZh = document.querySelector("#bookLocationZh");
const bookLocationEn = document.querySelector("#bookLocationEn");
const bookTitleZh = document.querySelector("#bookTitleZh");
const bookTitleEn = document.querySelector("#bookTitleEn");
const bookMeta = document.querySelector("#bookMeta");
const bookSummary = document.querySelector("#bookSummary");

const OFFICIAL_PUBLISHER_NAMES = {
  Princeton: "Princeton University Press",
  Duke: "Duke University Press",
  "UC Press": "University of California Press",
  Chicago: "The University of Chicago Press",
  Columbia: "Columbia University Press",
  Cambridge: "Cambridge University Press",
  Harvard: "Harvard University Press",
  Univocal: "Univocal Publishing",
  Athlone: "The Athlone Press",
};

function resolvePublisherLabel(raw) {
  if (!raw) return "";
  return OFFICIAL_PUBLISHER_NAMES[raw] ?? raw;
}

function splitTranslatedTitle(displayTitle) {
  const trimmed = String(displayTitle || "").trim();
  const match = /^([\s\S]+?)\s*\(([\s\S]+)\)\s*$/.exec(trimmed);
  const stripBookQuotes = (value) => String(value || "").replace(/[《》]/g, "").trim();
  if (!match) return { zh: stripBookQuotes(trimmed), en: "" };
  return { zh: stripBookQuotes(match[1]), en: match[2].trim() };
}

function fallbackEnglishLocation(book) {
  const loc = book.location || "";
  const region = book.countryOrRegion || "";
  if (!region) return loc;
  if (!loc) return region;
  return `${region} · ${loc}`;
}

function formatSummaryForCard(summary) {
  const text = String(summary || "").trim();
  if (!text) return "";

  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]*\n+[ \t]*/g, "\n")
    .replace(/([。！？])\s*/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function setScaleVar(name, value) {
  const safe = Number.isFinite(value) ? value : 1;
  document.documentElement.style.setProperty(name, String(safe));
}

function applyLockedTypeScales() {
  const saved = JSON.parse(localStorage.getItem("ethnoTypeScales") || "{}");
  const eyebrow = Number(saved.eyebrow) || 1;
  const title = Number(saved.title) || 1;
  const lede = Number(saved.lede) || 1;

  setScaleVar("--scale-eyebrow", eyebrow);
  setScaleVar("--scale-title", title);
  setScaleVar("--scale-lede", lede);
}

function applyLockedCardTypeScales() {
  const saved = JSON.parse(localStorage.getItem("ethnoCardTypeScales") || "{}");
  const values = {
    locZh: Number(saved.locZh) || 1,
    locEn: Number(saved.locEn) || 1,
    titleZh: Number(saved.titleZh) || 1,
    titleEn: Number(saved.titleEn) || 1,
    meta: Number(saved.meta) || 1,
    summary: Number(saved.summary) || 1,
  };

  setScaleVar("--scale-card-loc-zh", values.locZh);
  setScaleVar("--scale-card-loc-en", values.locEn);
  setScaleVar("--scale-card-title-zh", values.titleZh);
  setScaleVar("--scale-card-title-en", values.titleEn);
  setScaleVar("--scale-card-meta", values.meta);
  setScaleVar("--scale-card-summary", values.summary);
  syncBookCardLayout();
}

function introVarName(key, axis) {
  return `--intro-${key}-${axis}`;
}

function applyIntroOffsets(offsets) {
  for (const key of ["eyebrow", "title", "lede"]) {
    const item = offsets[key] || { x: 0, y: 0 };
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    document.documentElement.style.setProperty(introVarName(key, "x"), `${x}px`);
    document.documentElement.style.setProperty(introVarName(key, "y"), `${y}px`);
  }
}

function applyLockedIntroOffsets() {
  const stored = JSON.parse(localStorage.getItem("ethnoIntroOffsets") || "{}");
  const offsets = {
    eyebrow: { x: Number(stored?.eyebrow?.x) || 0, y: Number(stored?.eyebrow?.y) || 0 },
    title: { x: Number(stored?.title?.x) || 0, y: Number(stored?.title?.y) || 0 },
    lede: { x: Number(stored?.lede?.x) || 0, y: Number(stored?.lede?.y) || 0 },
  };
  applyIntroOffsets(offsets);
}

function nowrapRowsOverflow(panel) {
  const margin = 44;
  const inner = panel.clientWidth - margin;
  if (!bookLocationEn || !bookMeta) return false;

  const enNeeds = inner > 0 ? bookLocationEn.scrollWidth > inner : false;
  const metaNeeds = inner > 0 ? bookMeta.scrollWidth > inner : false;
  return enNeeds || metaNeeds;
}

function syncBookCardLayout() {
  if (bookCard.classList.contains("is-hidden")) return;

  const fixedPx = Math.min(420, Math.max(300, window.innerWidth - 48));
  bookCard.style.maxWidth = `${fixedPx}px`;
  bookCard.style.minWidth = `${fixedPx}px`;
  bookCard.classList.remove("book-card--tight", "book-card--tighter");
  bookCard.style.width = `${fixedPx}px`;

  requestAnimationFrame(() => {
    if (nowrapRowsOverflow(bookCard)) bookCard.classList.add("book-card--tight");
    requestAnimationFrame(() => {
      if (nowrapRowsOverflow(bookCard)) bookCard.classList.add("book-card--tighter");
    });
  });
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function sphericalToVector(lonDeg, latDeg) {
  const lon = toRadians(lonDeg);
  const lat = toRadians(latDeg);
  const cosLat = Math.cos(lat);

  return {
    x: cosLat * Math.sin(lon),
    y: Math.sin(lat),
    z: cosLat * Math.cos(lon),
  };
}

function simplifyRing(ring, step = 2) {
  if (ring.length <= 10) return ring;
  const simplified = [];

  for (let i = 0; i < ring.length; i += step) {
    simplified.push(ring[i]);
  }

  if (simplified[simplified.length - 1] !== ring[ring.length - 1]) {
    simplified.push(ring[ring.length - 1]);
  }

  return simplified;
}

function buildRingsFromGeometry(geometry) {
  const rings = [];
  const pushRing = (ring) => {
    if (!ring || ring.length < 3) return;
    const simplified = simplifyRing(ring, 2);
    const vectors = simplified.map(([lon, lat]) => sphericalToVector(lon, lat));
    rings.push(vectors);
  };

  if (geometry.type === "Polygon") {
    const [outer] = geometry.coordinates;
    // Interior rings (holes) are water cut-outs; omit them so inland seas aren’t shaded as land.
    pushRing(outer);
    return rings;
  }

  if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      const [outer] = polygon;
      pushRing(outer);
    }
  }

  return rings;
}

async function loadLandData() {
  try {
    const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const topology = await response.json();

    if (!window.topojson || typeof window.topojson.feature !== "function") {
      throw new Error("topojson-client is not available");
    }

    const featureLike = window.topojson.feature(topology, topology.objects.land);
    landRings = extractRings(featureLike);
    landReady = landRings.length > 0;
  } catch (error) {
    console.error("Failed to load land topology:", error);
  }
}

function extractRings(featureLike) {
  if (!featureLike) return [];

  if (featureLike.type === "FeatureCollection") {
    return featureLike.features.flatMap((feature) => buildRingsFromGeometry(feature.geometry));
  }

  if (featureLike.type === "Feature") {
    return buildRingsFromGeometry(featureLike.geometry);
  }

  return buildRingsFromGeometry(featureLike);
}

function resize() {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

  const shortSide = Math.min(state.width, state.height);
  state.radius = shortSide * (state.width < 760 ? 0.82 : 0.86);
  state.centerX = state.width * (state.width < 760 ? 0.74 : 0.73);
  state.centerY = state.height * (state.width < 760 ? 0.86 : 0.87);
}

function rotateVector(point) {
  let x = point.x;
  let y = point.y;
  let z = point.z;

  const cy = Math.cos(state.yaw);
  const sy = Math.sin(state.yaw);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];

  const cp = Math.cos(state.pitch);
  const sp = Math.sin(state.pitch);
  [y, z] = [y * cp - z * sp, y * sp + z * cp];

  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  [x, y] = [x * ct - y * st, x * st + y * ct];

  return { x, y, z };
}

function projectVector(vector, radius) {
  const rotated = rotateVector(vector);
  return {
    x: state.centerX + rotated.x * radius,
    y: state.centerY - rotated.y * radius,
    z: rotated.z,
  };
}

function drawGlobe(time) {
  state.intro += (1 - state.intro) * 0.035;

  if (!state.isDragging) {
    state.targetYaw += 0.00025;
    state.targetYaw += state.velocityX;
    state.targetPitch += state.velocityY;
    state.velocityX *= 0.92;
    state.velocityY *= 0.9;
  }

  state.targetPitch = Math.max(-0.85, Math.min(0.65, state.targetPitch));
  state.yaw += (state.targetYaw - state.yaw) * 0.12;
  state.pitch += (state.targetPitch - state.pitch) * 0.12;

  ctx.clearRect(0, 0, state.width, state.height);
  drawAtmosphere(time);
  if (landReady) drawLand();
  drawPins(time);
  syncCardPosition();
  requestAnimationFrame(drawGlobe);
}

function drawAtmosphere(time) {
  const introScale = 0.94 + state.intro * 0.06;
  const radius = state.radius * introScale;
  const shimmer = Math.sin(time * 0.0007) * 0.035;

  const glow = ctx.createRadialGradient(
    state.centerX - radius * 0.18,
    state.centerY - radius * 0.3,
    radius * 0.12,
    state.centerX,
    state.centerY,
    radius * 1.06
  );
  glow.addColorStop(0, `rgba(255, 250, 236, ${0.26 + shimmer})`);
  glow.addColorStop(0.55, "rgba(126, 112, 96, 0.08)");
  glow.addColorStop(1, "rgba(42, 36, 36, 0.13)");

  ctx.save();
  ctx.globalAlpha = state.intro;
  ctx.beginPath();
  ctx.arc(state.centerX, state.centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(52, 44, 44, 0.16)";
  ctx.stroke();
  ctx.restore();
}

function drawLand() {
  const introEase = 1 - Math.pow(1 - state.intro, 3);
  const radius = state.radius * (0.94 + state.intro * 0.06);

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const ring of landRings) {
    const projected = ring.map((point) => {
      const rotated = rotateVector(point);
      return {
        x: state.centerX + rotated.x * radius,
        y: state.centerY - rotated.y * radius,
        z: rotated.z,
      };
    });

    drawLandShape(projected, introEase, radius, -0.02);
  }

  ctx.restore();
}

function drawPins(time) {
  const radius = state.radius * (0.94 + state.intro * 0.06);
  const pulse = (Math.sin(time * 0.005) + 1) * 0.5;
  projectedPins = [];

  for (const book of books) {
    for (const pinPoint of book.pinPoints) {
      const point = projectVector(pinPoint.vector, radius);
      if (point.z <= 0.04) continue;

      const depth = Math.max(0, Math.min(1, point.z));
      const pinRadius = 3.8 + depth * 2.6;
      const pinKey = `${book.id}:${pinPoint.siteIndex}`;
      const isSelected =
        state.selectedBookId === book.id && state.selectedSiteIndex === pinPoint.siteIndex;
      const isHovered = hoveredPinId === pinKey;

      ctx.save();
      ctx.globalAlpha = 0.5 + depth * 0.5;
      ctx.beginPath();
      ctx.fillStyle = "rgba(214, 67, 47, 0.18)";
      ctx.arc(point.x, point.y, pinRadius + 4 + pulse * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.fillStyle = isSelected || isHovered ? "rgba(214, 67, 47, 0.96)" : "rgba(196, 58, 42, 0.9)";
      ctx.strokeStyle = "rgba(250, 245, 236, 0.9)";
      ctx.lineWidth = 1.2;
      ctx.arc(point.x, point.y, pinRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      projectedPins.push({
        id: book.id,
        siteIndex: pinPoint.siteIndex,
        pinKey,
        book,
        x: point.x,
        y: point.y,
        z: point.z,
        radius: pinRadius + 7,
      });
    }
  }
}

function drawLandShape(projected, introEase, radius, threshold) {
  const clippedResult = clipToFrontHemisphere(projected, threshold);
  const visible = clippedResult.points;

  if (visible.length < 3) return;

  const depth = visible.reduce((sum, point) => sum + point.z, 0) / visible.length;
  const alpha = Math.max(0, Math.min(1, (depth + 0.2) / 1.2)) * introEase;
  const horizonRadius = radius * Math.sqrt(1 - threshold * threshold);

  ctx.beginPath();
  drawClosedPathWithHorizonArc(visible, threshold, horizonRadius);
  ctx.fillStyle = `rgba(76, 67, 58, ${0.08 + alpha * 0.16})`;
  ctx.fill();
  ctx.strokeStyle = `rgba(42, 36, 36, ${0.2 + alpha * 0.28})`;
  ctx.lineWidth = 0.85 + alpha * 0.65;
  ctx.stroke();
}

function drawClosedPath(points) {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

function drawClosedPathWithHorizonArc(points, threshold, horizonRadius) {
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const currentOnHorizon = Math.abs(current.z - threshold) < 1e-6;
    const nextOnHorizon = Math.abs(next.z - threshold) < 1e-6;

    if (currentOnHorizon && nextOnHorizon) {
      drawHorizonArc(current, next, horizonRadius);
    } else {
      ctx.lineTo(next.x, next.y);
    }
  }

  ctx.closePath();
}

function drawHorizonArc(from, to, radius) {
  const centerX = state.centerX;
  const centerY = state.centerY;
  const start = Math.atan2(from.y - centerY, from.x - centerX);
  const end = Math.atan2(to.y - centerY, to.x - centerX);
  let delta = end - start;

  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;

  ctx.arc(centerX, centerY, radius, start, start + delta, delta < 0);
}

function clipToFrontHemisphere(points, threshold) {
  const clipped = [];
  let hasOutsidePoint = false;

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const previous = points[(i + points.length - 1) % points.length];
    const currentInside = current.z >= threshold;
    const previousInside = previous.z >= threshold;
    if (!currentInside) hasOutsidePoint = true;

    if (currentInside !== previousInside) {
      clipped.push(intersectAtDepth(previous, current, threshold));
    }

    if (currentInside) {
      clipped.push(current);
    }
  }

  return {
    points: clipped,
    clipped: hasOutsidePoint,
  };
}

function intersectAtDepth(a, b, threshold) {
  const t = (threshold - a.z) / (b.z - a.z);

  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: threshold,
  };
}

function onPointerDown(event) {
  state.isDragging = true;
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;
  state.velocityX = 0;
  state.velocityY = 0;
  state.dragDistance = 0;
  stage.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!state.isDragging) {
    updateHoverPin(event.clientX, event.clientY);
    return;
  }

  const dx = event.clientX - state.pointerX;
  const dy = event.clientY - state.pointerY;
  state.dragDistance += Math.abs(dx) + Math.abs(dy);
  state.pointerX = event.clientX;
  state.pointerY = event.clientY;

  state.velocityX = dx * 0.00075;
  state.velocityY = dy * 0.00055;
  state.targetYaw += dx * 0.004;
  state.targetPitch += dy * 0.003;
}

function onPointerUp(event) {
  const pointerX = event.clientX;
  const pointerY = event.clientY;
  state.isDragging = false;
  if (stage.hasPointerCapture(event.pointerId)) {
    stage.releasePointerCapture(event.pointerId);
  }

  if (state.dragDistance < 8) {
    const hit = getHitPin(pointerX, pointerY);
    if (hit) {
      state.selectedBookId = hit.id;
      state.selectedSiteIndex = hit.siteIndex;
      openBookCard(hit.book, hit.x, hit.y, hit.siteIndex);
      return;
    }
    closeBookCard();
    state.selectedBookId = null;
    state.selectedSiteIndex = 0;
  }
}

function getHitPin(x, y) {
  for (let i = projectedPins.length - 1; i >= 0; i -= 1) {
    const pin = projectedPins[i];
    const dx = x - pin.x;
    const dy = y - pin.y;
    if (dx * dx + dy * dy <= pin.radius * pin.radius) return pin;
  }
  return null;
}

function updateHoverPin(x, y) {
  const pin = getHitPin(x, y);
  hoveredPinId = pin ? pin.pinKey : null;
  stage.style.cursor = pin ? "pointer" : "grab";
}

function openBookCard(book, x, y, siteIndex = 0) {
  bookLocationZh.textContent =
    book.sourceField || [book.countryOrRegion, book.location].filter(Boolean).join(" - ");
  bookLocationEn.textContent = book.locationEn || fallbackEnglishLocation(book);

  const { zh, en } = splitTranslatedTitle(book.title);
  bookTitleZh.textContent = zh;
  bookTitleEn.textContent = en;
  bookTitleEn.classList.toggle("is-empty", !en);
  bookMeta.textContent = `${book.author} · ${book.year} · ${resolvePublisherLabel(book.publisher)}`;
  bookSummary.textContent = formatSummaryForCard(book.summary);
  bookCard.dataset.bookId = book.id;
  bookCard.dataset.siteIndex = String(siteIndex);
  bookCard.style.left = `${x}px`;
  bookCard.style.top = `${y}px`;
  bookCard.classList.remove("is-hidden");
  syncBookCardLayout();
}

function closeBookCard() {
  bookCard.classList.add("is-hidden");
  delete bookCard.dataset.bookId;
  delete bookCard.dataset.siteIndex;
}

function syncCardPosition() {
  if (bookCard.classList.contains("is-hidden")) return;

  const id = bookCard.dataset.bookId;
  const siteIndex = Number(bookCard.dataset.siteIndex || 0);
  const pin = projectedPins.find((item) => item.id === id && item.siteIndex === siteIndex);
  if (!pin || pin.z <= 0.03) {
    closeBookCard();
    state.selectedBookId = null;
    state.selectedSiteIndex = 0;
    return;
  }

  bookCard.style.left = `${pin.x}px`;
  bookCard.style.top = `${pin.y}px`;
}

window.addEventListener("resize", () => {
  resize();
  syncBookCardLayout();
});
stage.addEventListener("pointerdown", onPointerDown);
stage.addEventListener("pointermove", onPointerMove);
stage.addEventListener("pointerup", onPointerUp);
stage.addEventListener("pointercancel", onPointerUp);
bookCardClose.addEventListener("click", () => {
  closeBookCard();
  state.selectedBookId = null;
  state.selectedSiteIndex = 0;
});

resize();
applyLockedTypeScales();
applyLockedCardTypeScales();
applyLockedIntroOffsets();
loadLandData();
requestAnimationFrame(drawGlobe);
