// Todos os testes do puzzle do Adão Araújo. O ficheiro é autónomo: não importa
// nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Adão";
const SLUG = "adao-araujo";
const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

/*
 * As medidas do jogo lêem-se da própria página: se lá mudarem, os testes mudam
 * com elas em vez de ficarem a falar de um jogo que já não existe.
 */
const constant = (name) => {
  const found = html.match(new RegExp(`const ${name} = (\\d+);`));
  if (!found) throw new Error(`não encontrei a constante ${name} na página`);
  return Number(found[1]);
};

const COLS = constant("COLS");
const ROWS = constant("ROWS");
const TURF_COLS = constant("TURF_COLS");
const TURF_ROWS = constant("TURF_ROWS");
const WAVES = constant("WAVES");
const FLIGHT_COLS = constant("FLIGHT_COLS");
const FLIGHT_ROWS = constant("FLIGHT_ROWS");
const SHIP_WIDTH = constant("SHIP_WIDTH");
const SHIP_ROW = constant("SHIP_ROW");
const LIVES = constant("LIVES");
const SAND_LAYERS = constant("SAND_LAYERS");
const TICK = constant("TICK");

const FLIGHT_SIZE = FLIGHT_COLS * FLIGHT_ROWS;
const TURF_TILES = TURF_COLS * TURF_ROWS;
// A página dá tempo a ver o campo já todo fotografia antes de abrir a festa.
const PARTY_DELAY = 2600;

let dom = null;
let clock = null;

/** Gerador determinista, para que os ovos caiam sempre nos mesmos sítios. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * Um relógio que só anda quando lhe mandam. O jogo mede-se todo em setTimeout e
 * setInterval da janela, por isso trocá-los aqui deixa jogar as quatro vagas num
 * instante — e sempre da mesma maneira.
 */
function installClock(window) {
  let now = 0;
  let nextId = 1;
  const jobs = new Map();

  window.setTimeout = (action, delay = 0) => {
    const id = nextId++;
    jobs.set(id, { action, at: now + delay, every: 0 });
    return id;
  };
  window.setInterval = (action, delay = 0) => {
    const id = nextId++;
    jobs.set(id, { action, at: now + delay, every: Math.max(1, delay) });
    return id;
  };
  window.clearTimeout = (id) => jobs.delete(id);
  window.clearInterval = (id) => jobs.delete(id);

  return {
    advance(milliseconds) {
      const target = now + milliseconds;
      for (let guard = 0; guard < 100000; guard += 1) {
        let due = null;
        for (const [id, job] of jobs) {
          if (job.at <= target && (due === null || job.at < due.job.at)) due = { id, job };
        }
        if (due === null) break;
        now = due.job.at;
        if (due.job.every) due.job.at = now + due.job.every;
        else jobs.delete(due.id);
        due.job.action();
      }
      now = target;
    },
  };
}

function openPage({ seed = 20260902 } = {}) {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
    beforeParse(window) {
      window.Math.random = seededRandom(seed);
      clock = installClock(window);
    },
  });
  return dom.window.document;
}

const click = (document, id) => document.querySelector(`#${id}`).click();
const field = (document) => document.querySelector("#field");
const stateOf = (document) => field(document).dataset.state;
const number = (element, key) => Number(element.dataset[key]);
const birds = (document) => [...document.querySelectorAll('.invader[data-alive="1"]')];
const sand = (document) => [...document.querySelectorAll(".sand")];
const eggs = (document) => [...document.querySelectorAll(".egg")];
const ball = (document) => document.querySelector(".ball");
const shipCol = (document) => number(document.querySelector(".ship"), "col");
const lifted = (document) => document.querySelectorAll('.turf-tile[data-lifted="1"]').length;

/** Encosta o taco de maneira a que a bola saia pela coluna pedida. */
function aim(document, lane) {
  const wanted = Math.max(0, Math.min(COLS - SHIP_WIDTH, lane - 1));
  for (let step = 0; step < COLS + 2; step += 1) {
    if (shipCol(document) === wanted) break;
    click(document, shipCol(document) < wanted ? "rightButton" : "leftButton");
  }
  return shipCol(document) + 1;
}

/** Escolhe a ave da frente por uma coluna que a areia não tape, e bate-lhe. */
function aimAndFire(document) {
  const blocked = new Set(sand(document).map((block) => number(block, "col")));
  const live = birds(document).map((element) => ({
    col: number(element, "col"),
    row: number(element, "row"),
  }));
  if (live.length === 0) return;

  const open = live.filter((bird) => !blocked.has(bird.col) || !blocked.has(bird.col + 1));
  const target = (open.length ? open : live).sort((one, other) => other.row - one.row)[0];
  aim(document, blocked.has(target.col) ? target.col + 1 : target.col);
  click(document, "fireButton");
}

/** Foge dos ovos que já vêm perto do taco. */
function dodge(document) {
  const threats = eggs(document)
    .map((element) => ({ col: number(element, "col"), row: Number(element.dataset.row) }))
    .filter((egg) => egg.row > SHIP_ROW - 9);
  if (threats.length === 0) return;

  let best = null;
  for (let col = 0; col <= COLS - SHIP_WIDTH; col += 1) {
    const room = Math.min(...threats.map((egg) => Math.abs(egg.col - (col + 1))));
    const worth = room * 10 - Math.abs(col - shipCol(document));
    if (best === null || worth > best.worth) best = { col, worth };
  }
  aim(document, best.col + 1);
}

/** Joga sozinho: aponta, bate, foge, e deixa o relógio andar um passo de cada vez. */
function play(document, { maxTicks = 40000 } = {}) {
  for (let step = 0; step < maxTicks; step += 1) {
    const state = stateOf(document);
    if (state === "won" || state === "lost") break;
    if (state === "ready") click(document, "startButton");
    if (stateOf(document) === "playing") {
      if (!ball(document)) aimAndFire(document);
      dodge(document);
    }
    clock.advance(TICK);
  }
  return stateOf(document);
}

afterEach(() => {
  dom?.window.close();
  dom = null;
  clock = null;
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

describe(`Puzzle do ${PERSON} — o green`, () => {
  it("tem tantas aves ao todo como bocados de relva a levantar", () => {
    // É esta conta que faz a última ave levantar o último bocado de relva.
    expect(WAVES * FLIGHT_SIZE).toBe(TURF_TILES);
  });

  it("tapa a fotografia com a relva toda, cortada às listas", () => {
    const document = openPage();
    const tiles = [...document.querySelectorAll(".turf-tile")];

    expect(tiles).toHaveLength(TURF_TILES);
    expect(lifted(document)).toBe(0);
    // As listas do corte alternam de coluna para coluna.
    expect(tiles[0].dataset.stripe).toBe("0");
    expect(tiles[1].dataset.stripe).toBe("1");
    // A fotografia está mesmo por baixo do campo, à espera.
    expect(html).toMatch(/\.field-wrap\s*\{[^}]*photo\.jpg/);
  });

  it("põe em campo a revoada, os bunkers e o taco", () => {
    const document = openPage();

    expect(birds(document)).toHaveLength(FLIGHT_SIZE);
    // Uma linha de cada ave rara e o resto de birdies, tal como no golfe.
    const kinds = birds(document).map((bird) => bird.dataset.kind);
    expect(kinds.filter((kind) => kind === "albatroz")).toHaveLength(FLIGHT_COLS);
    expect(kinds.filter((kind) => kind === "aguia")).toHaveLength(FLIGHT_COLS);
    expect(kinds.filter((kind) => kind === "birdie")).toHaveLength(FLIGHT_COLS * 2);

    expect(sand(document).length).toBeGreaterThan(0);
    sand(document).forEach((block) => expect(number(block, "strength")).toBe(SAND_LAYERS));

    expect(document.querySelectorAll(".life-dot")).toHaveLength(LIVES);
    expect(field(document).dataset.lives).toBe(String(LIVES));
    expect(field(document).dataset.wave).toBe("1");
    expect(stateOf(document)).toBe("ready");
  });

  it("move o taco para os lados e pára nas bermas", () => {
    const document = openPage();
    const start = shipCol(document);

    click(document, "leftButton");
    expect(shipCol(document)).toBe(start - 1);

    click(document, "rightButton");
    expect(shipCol(document)).toBe(start);

    for (let step = 0; step < COLS + 4; step += 1) click(document, "leftButton");
    expect(shipCol(document)).toBe(0);

    for (let step = 0; step < COLS * 2; step += 1) click(document, "rightButton");
    expect(shipCol(document)).toBe(COLS - SHIP_WIDTH);
  });

  it("manda uma bola de cada vez, e ela sobe pelo campo", () => {
    const document = openPage();

    click(document, "fireButton");
    const flying = ball(document);
    expect(flying).not.toBeNull();
    expect(number(flying, "col")).toBe(shipCol(document) + 1);
    const first = Number(flying.dataset.row);

    clock.advance(TICK);
    expect(Number(ball(document).dataset.row)).toBeLessThan(first);

    // Enquanto essa não se resolve, o taco não manda outra.
    click(document, "fireButton");
    expect(document.querySelectorAll(".ball")).toHaveLength(1);
  });

  it("derruba a ave e levanta um bocado de relva por cada uma", () => {
    const document = openPage();

    aimAndFire(document);
    for (let step = 0; step < 200 && number(field(document), "kills") === 0; step += 1) {
      clock.advance(TICK);
    }

    expect(number(field(document), "kills")).toBe(1);
    expect(birds(document)).toHaveLength(FLIGHT_SIZE - 1);
    expect(lifted(document)).toBe(1);
    expect(number(field(document), "score")).toBeGreaterThan(0);
  });

  it("a areia do bunker pára a bola e gasta-se camada a camada", () => {
    const document = openPage();
    const lane = number(sand(document)[0], "col");
    const before = sand(document).length;

    for (let shot = 0; shot < SAND_LAYERS; shot += 1) {
      aim(document, lane);
      click(document, "fireButton");
      for (let step = 0; step < 200 && ball(document); step += 1) clock.advance(TICK);
    }

    // Nenhuma ave caiu: a areia levou com tudo.
    expect(number(field(document), "kills")).toBe(0);
    expect(sand(document).length).toBe(before - 1);
  });

  it("a revoada anda de lado e desce quando bate na berma", () => {
    const document = openPage();
    const leftmost = () => Math.min(...birds(document).map((bird) => number(bird, "col")));
    const highest = () => Math.min(...birds(document).map((bird) => number(bird, "row")));

    click(document, "startButton");
    const startCol = leftmost();
    const startRow = highest();

    // Um passo chega para a revoada andar de lado.
    for (let step = 0; step < 200 && leftmost() === startCol; step += 1) clock.advance(TICK);
    expect(leftmost()).not.toBe(startCol);

    // E ao fim de umas quantas idas e vindas já vem mais perto do green.
    for (let step = 0; step < 1200 && highest() === startRow; step += 1) clock.advance(TICK);
    expect(highest()).toBeGreaterThan(startRow);
  });

  it("pára e retoma o jogo no mesmo botão", () => {
    const document = openPage();
    const startButton = document.querySelector("#startButton");

    click(document, "fireButton");
    expect(stateOf(document)).toBe("playing");
    expect(startButton.textContent).toBe("Pausar");

    click(document, "startButton");
    expect(stateOf(document)).toBe("paused");
    expect(document.querySelector("#pauseVeil").classList.contains("visible")).toBe(true);
    expect(startButton.textContent).toBe("Continuar");

    // Em pausa, o taco não se mexe e o campo fica quieto.
    const parked = shipCol(document);
    click(document, "leftButton");
    expect(shipCol(document)).toBe(parked);
    const frozen = ball(document)?.dataset.row;
    clock.advance(TICK * 10);
    expect(ball(document)?.dataset.row).toBe(frozen);

    click(document, "startButton");
    expect(stateOf(document)).toBe("playing");
    click(document, "leftButton");
    expect(shipCol(document)).toBe(parked - 1);
  });
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

  it("limpa as quatro vagas, levanta a relva toda e festeja com o nome", () => {
    const document = openPage();

    expect(play(document)).toBe("won");

    expect(number(field(document), "kills")).toBe(WAVES * FLIGHT_SIZE);
    expect(number(field(document), "wave")).toBe(WAVES);
    // Nem um bocado de relva por levantar: a fotografia está toda à vista.
    expect(lifted(document)).toBe(TURF_TILES);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain(`${WAVES * FLIGHT_SIZE} aves`);

    clock.advance(PARTY_DELAY);
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
  });

  it("deixa ver a fotografia inteira antes de abrir a festa", () => {
    const document = openPage();
    play(document);

    // Caída a última ave, o campo já é a fotografia — e a festa ainda não entrou.
    expect(lifted(document)).toBe(TURF_TILES);
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);

    clock.advance(PARTY_DELAY);

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    // O cartão da festa leva a fotografia consigo, para não a tapar por completo.
    expect(document.querySelector(".celebration-photo")).not.toBeNull();
    expect(html).toMatch(/\.celebration-photo\s*\{[^}]*photo\.jpg/);
  });

  it("ignora os comandos depois de o green estar limpo", () => {
    const document = openPage();
    play(document);
    clock.advance(PARTY_DELAY);

    click(document, "fireButton");
    click(document, "leftButton");
    clock.advance(TICK * 20);

    expect(ball(document)).toBeNull();
    expect(stateOf(document)).toBe("won");
    expect(lifted(document)).toBe(TURF_TILES);
  });

  it("fecha a festa com a tecla Escape", () => {
    const document = openPage();
    play(document);
    clock.advance(PARTY_DELAY);

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  });

  it("recomeça o jogo a partir da festa", () => {
    const document = openPage();
    play(document);
    clock.advance(PARTY_DELAY);

    click(document, "playAgainButton");

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(stateOf(document)).toBe("ready");
    expect(field(document).dataset.wave).toBe("1");
    expect(number(field(document), "kills")).toBe(0);
    expect(number(field(document), "score")).toBe(0);
    expect(lifted(document)).toBe(0);
    expect(birds(document)).toHaveLength(FLIGHT_SIZE);
  });

  it("convida a recomeçar quando as aves pousam no green", () => {
    const document = openPage({ seed: 7 });

    // Sem bater em nada e sem sair do sítio, o green acaba por ser tomado.
    click(document, "startButton");
    for (let step = 0; step < 8000 && stateOf(document) !== "lost"; step += 1) {
      clock.advance(TICK);
    }
    clock.advance(1000);

    expect(stateOf(document)).toBe("lost");
    expect(document.querySelector("#gameOver").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#gameOverText").textContent).toContain(PERSON);

    click(document, "tryAgainButton");
    expect(document.querySelector("#gameOver").classList.contains("visible")).toBe(false);
    expect(stateOf(document)).toBe("ready");
    expect(birds(document)).toHaveLength(FLIGHT_SIZE);
  });
});
