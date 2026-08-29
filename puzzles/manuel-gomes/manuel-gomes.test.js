// Todos os testes do puzzle do Manuel Gomes. O ficheiro é autónomo: não importa
// nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Manuel";
const SLUG = "manuel-gomes";
const HOLES = 9;
const SIZE = 6;
const TOTAL_PAR = 35;
// A página dá tempo a ver o campo já todo fotografia antes de abrir a festa.
const PARTY_DELAY = 2500;

const WAYS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const BUTTON = { up: "upButton", down: "downButton", left: "leftButton", right: "rightButton" };

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

let dom = null;

function openPage() {
  dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: PAGE_URL });
  return dom.window.document;
}

const green = (document) => document.querySelector("#green");
const click = (document, id) => document.querySelector(`#${id}`).click();
const at = (document, key) => green(document).dataset[key];
const num = (document, key) => Number(at(document, key));
const cell = (document, key) => at(document, key).split(",").map(Number);
const opened = (document) => num(document, "opened");
const total = (document) => Number(document.querySelector("#strokeTotal").textContent);
const tiles = (document) => [...document.querySelectorAll(".tile")];
const hazards = (document, kind) => [...document.querySelectorAll(`.hazard[data-kind="${kind}"]`)];
const openTiles = (document) => tiles(document).filter((tile) => tile.dataset.state === "open");

/** Espera que a bola pare de deslizar — e que o buraco seguinte fique montado. */
async function settle(document, limit = 8000) {
  const until = Date.now() + limit;
  while (at(document, "busy") === "1") {
    if (Date.now() > until) throw new Error("a bola não parou de deslizar");
    await new Promise((done) => dom.window.setTimeout(done, 10));
  }
}

async function hit(document, direction) {
  click(document, BUTTON[direction]);
  await settle(document);
}

/*
 * Os testes lêem o tabuleiro tal como ele está desenhado na página — casa a
 * casa — e resolvem-no por si. É assim que se confirma que o par que a página
 * mostra é mesmo o caminho mais curto, sem acreditar na conta dela.
 */
function readBoard(document) {
  const cells = Array.from({ length: SIZE }, () => Array(SIZE).fill("."));
  document.querySelectorAll(".hazard").forEach((hazard) => {
    const [x, y] = hazard.dataset.cell.split(",").map(Number);
    cells[y][x] = { tree: "T", sand: "S", water: "~" }[hazard.dataset.kind];
  });
  const [cupX, cupY] = cell(document, "cup");
  cells[cupY][cupX] = "O";
  return cells;
}

function slide(cells, from, [dx, dy]) {
  let { x, y } = from;
  const path = [];
  for (;;) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) break;
    const mark = cells[ny][nx];
    if (mark === "T") break;
    path.push({ x: nx, y: ny });
    if (mark === "~") return { path, outcome: "water" };
    if (mark === "O") return { path, outcome: "sunk" };
    x = nx;
    y = ny;
    if (mark === "S") return { path, outcome: "sand" };
  }
  return { path, outcome: path.length ? "rest" : "blocked" };
}

/** O caminho mais curto até ao copo, em nomes de setas. */
function route(cells, from) {
  const seen = new Map([[`${from.x},${from.y}`, []]]);
  let edge = [from];
  while (edge.length) {
    const next = [];
    for (const spot of edge) {
      const so = seen.get(`${spot.x},${spot.y}`);
      for (const [name, way] of Object.entries(WAYS)) {
        const { path, outcome } = slide(cells, spot, way);
        if (outcome === "sunk") return [...so, name];
        if (outcome !== "rest" && outcome !== "sand") continue;
        const stop = path.at(-1);
        const key = `${stop.x},${stop.y}`;
        if (seen.has(key)) continue;
        seen.set(key, [...so, name]);
        next.push(stop);
      }
    }
    edge = next;
  }
  return null;
}

/** Fecha o buraco onde a bola está, pelo caminho mais curto que houver. */
async function sinkHole(document) {
  const [x, y] = cell(document, "ball");
  const moves = route(readBoard(document), { x, y });
  expect(moves, `o buraco ${at(document, "hole")} não tem saída`).not.toBeNull();
  // O par que a página mostra é o número de tacadas desse caminho.
  expect(moves.length).toBe(num(document, "par"));
  for (const move of moves) await hit(document, move);
  return moves;
}

/** Joga a volta toda, ou só até ao buraco pedido. */
async function playRound(document, { upTo = HOLES } = {}) {
  const played = [];
  while (num(document, "hole") < upTo && at(document, "solved") !== "1") played.push(await sinkHole(document));
  if (upTo === HOLES && at(document, "solved") !== "1") played.push(await sinkHole(document));
  return played;
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe(`Puzzle do ${PERSON} — página`, () => {
  it("anuncia a pessoa no título e no cabeçalho", () => {
    const document = openPage();
    expect(document.title).toContain(PERSON);
    expect(document.querySelector("h1").textContent).toContain(PERSON);
  });

  it("aponta as ligações públicas para a pasta do próprio puzzle", () => {
    const document = openPage();

    expect(document.querySelector('link[rel="canonical"]').href).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:url"]').content).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
    expect(document.querySelector('meta[name="twitter:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
  });

  it("é autónoma: só usa ficheiros da sua própria pasta", () => {
    expect(html).not.toContain("../");
    const document = openPage();
    document.querySelectorAll("script[src], link[href], img[src]").forEach((element) => {
      const reference = element.getAttribute("src") ?? element.getAttribute("href");
      const isLocal = reference.startsWith("./");
      const isAbsoluteUrl = /^https?:\/\//.test(reference);
      expect(isLocal || isAbsoluteUrl).toBe(true);
    });
  });

  it("tem todos os ficheiros que a página pede à sua pasta", () => {
    const references = [...html.matchAll(/\.\/(assets\/[\w.-]+)/g)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    new Set(references).forEach((reference) => {
      expect(existsSync(resolve(puzzleDir, reference)), `falta ${reference}`).toBe(true);
    });
  });
});

describe(`Puzzle do ${PERSON} — o tabuleiro`, () => {
  it("o tabuleiro e a fotografia são a mesma grelha de 36 casas", () => {
    const document = openPage();
    const grass = tiles(document);

    expect(grass).toHaveLength(SIZE * SIZE);
    const crops = grass.map((tile) => tile.style.backgroundPosition);
    expect(new Set(crops).size).toBe(SIZE * SIZE);
    expect(crops[0]).toBe("0% 0%");
    expect(crops.at(-1)).toBe("100% 100%");
    grass.forEach((tile) => expect(tile.style.backgroundImage).toContain("photo.jpg"));
    // E adivinha-se por baixo da relva, nas juntas entre as casas.
    expect(html).toMatch(/\.green::before\s*\{[^}]*photo\.jpg/);
  });

  it("começa no primeiro buraco, com a bola no tee e o cartão a zero", () => {
    const document = openPage();

    expect(num(document, "hole")).toBe(1);
    expect(document.querySelector("#holeGoal").textContent).toBe(`/${HOLES}`);
    expect(cell(document, "ball")).toEqual([0, 5]);
    expect(cell(document, "cup")).toEqual([3, 2]);
    expect(total(document)).toBe(0);
    // A casa de onde a bola parte já está destapada; as outras 35 não.
    expect(opened(document)).toBe(1);
    expect(openTiles(document)).toHaveLength(1);
  });

  it("desenha os obstáculos casa a casa, e o primeiro buraco só tem uma árvore", () => {
    const document = openPage();

    expect(hazards(document, "tree")).toHaveLength(1);
    expect(hazards(document, "tree")[0].dataset.cell).toBe("4,5");
    expect(hazards(document, "sand")).toHaveLength(0);
    expect(hazards(document, "water")).toHaveLength(0);
    // Cada obstáculo enche a casa dele: um sexto do campo, no canto dela.
    expect(hazards(document, "tree")[0].style.left).toBe(`${(4 * 100) / SIZE}%`);
  });

  it("o par que a página mostra é o caminho mais curto que o tabuleiro tem", () => {
    const document = openPage();

    expect(num(document, "par")).toBe(2);
    expect(document.querySelector("#holeBadge").textContent).toContain("par 2");
    expect(route(readBoard(document), { x: 0, y: 5 })).toEqual(["right", "up"]);
    expect(document.querySelector("#scorecard").getAttribute("aria-label")).toContain(`par ${TOTAL_PAR}`);
  });

  it("a bola desliza até bater na árvore, e nunca pára a meio", async () => {
    const document = openPage();

    await hit(document, "right");

    // A árvore está em 4,5: a bola pára na casa antes dela.
    expect(cell(document, "ball")).toEqual([3, 5]);
    expect(total(document)).toBe(1);
    // E levantou a relva de tudo por onde passou, mais a casa de onde saiu.
    expect(opened(document)).toBe(4);
    ["0,5", "1,5", "2,5", "3,5"].forEach((spot) => {
      const [x, y] = spot.split(",").map(Number);
      expect(tiles(document)[y * SIZE + x].dataset.state).toBe("open");
    });
  });

  it("bater contra o que está encostado não conta como tacada", async () => {
    const document = openPage();

    // A bola está na última linha: para baixo não há para onde ir.
    await hit(document, "down");

    expect(cell(document, "ball")).toEqual([0, 5]);
    expect(total(document)).toBe(0);
    expect(opened(document)).toBe(1);
  });

  it("o copo apanha a bola de passagem", async () => {
    const document = openPage();

    await hit(document, "right");
    await hit(document, "up");
    // O copo está em 3,2 e a bola subiu pela coluna 3: cai lá dentro ao passar.
    await settle(document);

    expect(num(document, "hole")).toBe(2);
    const box = document.querySelectorAll(".score-box")[0];
    expect(box.querySelector(".score-strokes").textContent).toBe("2");
    expect(box.dataset.result).toBe("par");
    expect(document.querySelectorAll(".score-box")[1].dataset.result).toBe("playing");
  }, 20000);

  it("a areia agarra a bola na primeira casa que ela pisa", async () => {
    const document = openPage();
    await playRound(document, { upTo: 2 });

    expect(num(document, "hole")).toBe(2);
    expect(hazards(document, "sand").map((sand) => sand.dataset.cell)).toContain("1,0");

    await hit(document, "up");
    expect(cell(document, "ball")).toEqual([0, 0]);
    // Para a direita há areia logo ao lado: a bola entra nela e fica.
    await hit(document, "right");
    expect(cell(document, "ball")).toEqual([1, 0]);
  }, 30000);

  it("a água custa uma tacada e devolve a bola ao sítio de onde saiu", async () => {
    const document = openPage();
    await playRound(document, { upTo: 3 });

    expect(num(document, "hole")).toBe(3);
    await hit(document, "up");

    const before = cell(document, "ball");
    const strokesBefore = total(document);
    // Daqui para a direita é lago.
    await hit(document, "right");

    expect(cell(document, "ball")).toEqual(before);
    expect(total(document)).toBe(strokesBefore + 2);
    expect(num(document, "hole")).toBe(3);
  }, 40000);
});

describe(`Puzzle do ${PERSON} — fotografia e final`, () => {
  it("mostra e esconde a pré-visualização da fotografia", () => {
    const document = openPage();
    const preview = document.querySelector("#preview");
    const button = document.querySelector("#previewButton");

    button.click();
    expect(preview.classList.contains("visible")).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    button.click();
    expect(preview.classList.contains("visible")).toBe(false);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("recomeça de relva fechada e outra vez no primeiro tee", async () => {
    const document = openPage();
    await playRound(document, { upTo: 2 });

    click(document, "restartButton");

    expect(num(document, "hole")).toBe(1);
    expect(total(document)).toBe(0);
    expect(cell(document, "ball")).toEqual([0, 5]);
    expect(opened(document)).toBe(1);
    expect(at(document, "solved")).toBeUndefined();
    document.querySelectorAll(".score-box").forEach((box) => {
      expect(box.querySelector(".score-strokes").textContent).toBe("–");
    });
  }, 30000);

  it("uma volta no par fecha os nove buracos e destapa a fotografia inteira", async () => {
    const document = openPage();

    const played = await playRound(document);

    // Nove buracos, cada um pelo caminho mais curto: o total é o par do campo.
    expect(played).toHaveLength(HOLES);
    expect(total(document)).toBe(TOTAL_PAR);
    expect(at(document, "solved")).toBe("1");
    expect(opened(document)).toBe(SIZE * SIZE);
    tiles(document).forEach((tile) => expect(tile.dataset.state).toBe("open"));
    expect(document.querySelector("#turf").classList.contains("solved")).toBe(true);
    // Já não se bate mais: a volta acabou.
    expect(document.querySelector("#upButton").disabled).toBe(true);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain("nove buracos");
    expect(text).toContain(`${TOTAL_PAR} tacadas`);
    expect(text).toContain("tudo no par");

    // A fotografia fica um bocado à vista antes de a festa entrar.
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
    // O cartão da festa leva a fotografia consigo, para não a tapar por completo.
    expect(document.querySelector(".celebration-photo")).not.toBeNull();
    expect(html).toMatch(/\.celebration-photo\s*\{[^}]*photo\.jpg/);

    // E fecha-se com a tecla Escape, como todas as outras.
    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  }, 120000);
});
