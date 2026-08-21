// Todos os testes do puzzle do João Freitas. O ficheiro é autónomo: não importa
// nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "João";
const SLUG = "joao-freitas";
const HOLES = 9;
// A página dá tempo a ver o campo já todo fotografia antes de abrir a festa.
const PARTY_DELAY = 2500;

// As mesmas medidas da página, para que os testes saibam bater a bola a sério.
const TRAVAGEM = 360;
const MIN_SPEED = 70;
const MAX_SPEED = 320;
const AIM_STEP = 2;

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
const pair = (document, key) => at(document, key).split(",").map(Number);
const hole = (document) => Number(at(document, "hole"));
const opened = (document) => Number(at(document, "opened"));
const total = (document) => Number(document.querySelector("#strokeTotal").textContent);
const tiles = (document) => [...document.querySelectorAll(".tile")];
const boxes = (document) => [...document.querySelectorAll(".score-box")];

/** Espera que a bola pare de rolar — e que o buraco seguinte fique montado. */
async function settle(document, limit = 8000) {
  const until = Date.now() + limit;
  while (at(document, "busy") === "1") {
    if (Date.now() > until) throw new Error("a bola não parou de rolar");
    await new Promise((done) => dom.window.setTimeout(done, 15));
  }
}

/**
 * A tacada certa para o buraco onde a bola está: a direcção é a linha directa
 * até ao copo, e a força sai de distância = velocidade² / (2 × travagem).
 */
function straightShot(document) {
  const [ballX, ballY] = pair(document, "ball");
  const [cupX, cupY] = pair(document, "cup");
  const distance = Math.hypot(cupX - ballX, cupY - ballY);
  const degrees = (Math.atan2(cupY - ballY, cupX - ballX) * 180) / Math.PI;
  const speed = Math.sqrt(2 * TRAVAGEM * distance);
  return {
    angle: (Math.round(degrees / AIM_STEP) * AIM_STEP + 360) % 360,
    force: Math.min(100, Math.max(10, Math.round(((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100))),
  };
}

function aimAt(document, target) {
  for (let turn = 0; turn < 200 && Number(at(document, "angle")) !== target; turn += 1) {
    const gap = ((target - Number(at(document, "angle")) + 540) % 360) - 180;
    click(document, gap > 0 ? "aimRightButton" : "aimLeftButton");
  }
}

function setForce(document, value) {
  const power = document.querySelector("#power");
  power.value = String(value);
  power.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

async function shoot(document, { angle, force }) {
  aimAt(document, angle);
  setForce(document, force);
  click(document, "shootButton");
  await settle(document);
}

/** Fecha o buraco em que a bola está, custe as tacadas que custar. */
async function sinkHole(document) {
  const started = hole(document);
  for (let shots = 0; shots < 6; shots += 1) {
    await shoot(document, straightShot(document));
    if (hole(document) !== started || at(document, "solved") === "1") return;
  }
  throw new Error(`não consegui fechar o buraco ${started}`);
}

/** Joga a volta toda, ou só até ao buraco pedido. */
async function playRound(document, { upTo = HOLES } = {}) {
  while (hole(document) < upTo && at(document, "solved") !== "1") await sinkHole(document);
  if (upTo === HOLES && at(document, "solved") !== "1") await sinkHole(document);
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

describe(`Puzzle do ${PERSON} — o campo`, () => {
  it("tapa a fotografia com nove casas de relva, cada uma com o seu pedaço", () => {
    const document = openPage();
    const grass = tiles(document);

    expect(grass).toHaveLength(9);
    grass.forEach((tile) => expect(tile.dataset.state).toBe("grass"));

    const crops = grass.map((tile) => tile.style.backgroundPosition);
    expect(new Set(crops).size).toBe(9);
    expect(crops[0]).toBe("0% 0%");
    expect(crops.at(-1)).toBe("100% 100%");
    grass.forEach((tile) => expect(tile.style.backgroundImage).toContain("photo.jpg"));
    // E adivinha-se por baixo da relva, nas juntas entre as casas.
    expect(html).toMatch(/\.green::before\s*\{[^}]*photo\.jpg/);
  });

  it("começa no primeiro buraco, com a bola no sítio e a mira apontada ao copo", () => {
    const document = openPage();

    expect(hole(document)).toBe(1);
    expect(opened(document)).toBe(0);
    expect(total(document)).toBe(0);
    expect(document.querySelector("#holeGoal").textContent).toBe(`/${HOLES}`);
    expect(pair(document, "ball")).toEqual([50, 84]);
    // Da bola até ao copo é a direito para cima: 270 graus.
    expect(Number(at(document, "angle"))).toBe(270);
  });

  it("desenha um cartão de pontuação com uma casa por buraco", () => {
    const document = openPage();
    const card = boxes(document);

    expect(card).toHaveLength(HOLES);
    expect(card[0].dataset.result).toBe("playing");
    card.forEach((box) => expect(box.querySelector(".score-strokes").textContent).toBe("–"));
  });

  it("roda a mira dois graus de cada vez, para um lado e para o outro", () => {
    const document = openPage();
    const start = Number(at(document, "angle"));

    click(document, "aimRightButton");
    expect(Number(at(document, "angle"))).toBe(start + AIM_STEP);

    click(document, "aimLeftButton");
    click(document, "aimLeftButton");
    expect(Number(at(document, "angle"))).toBe(start - AIM_STEP);

    // A mira dá a volta inteira sem nunca sair de 0–359.
    for (let turn = 0; turn < 200; turn += 1) click(document, "aimRightButton");
    const angle = Number(at(document, "angle"));
    expect(angle).toBeGreaterThanOrEqual(0);
    expect(angle).toBeLessThan(360);
  });

  it("a linha de mira cresce com a força escolhida", () => {
    const document = openPage();
    const aim = document.querySelector("#aim");

    setForce(document, 20);
    const short = Number.parseFloat(aim.style.width);
    expect(document.querySelector("#powerValue").textContent).toBe("20");

    setForce(document, 90);
    expect(Number.parseFloat(aim.style.width)).toBeGreaterThan(short);
  });

  it("bate a bola e ela pára no relvado quando a força é curta", async () => {
    const document = openPage();

    await shoot(document, { angle: 270, force: 10 });

    const [, ballY] = pair(document, "ball");
    // Andou para cima, mas ficou muito longe do copo.
    expect(ballY).toBeGreaterThan(70);
    expect(ballY).toBeLessThan(84);
    expect(hole(document)).toBe(1);
    expect(opened(document)).toBe(0);
    expect(total(document)).toBe(1);
  });

  it("não deixa bater outra vez enquanto a bola rola", async () => {
    const document = openPage();

    setForce(document, 40);
    click(document, "shootButton");

    expect(at(document, "busy")).toBe("1");
    expect(document.querySelector("#shootButton").disabled).toBe(true);
    expect(document.querySelector("#aimLeftButton").disabled).toBe(true);

    click(document, "shootButton");
    await settle(document);

    // A segunda tentativa não contou: só houve uma tacada.
    expect(total(document)).toBe(1);
    expect(document.querySelector("#shootButton").disabled).toBe(false);
  });

  it("fecha o primeiro buraco, destapa uma casa e passa ao seguinte", async () => {
    const document = openPage();

    await sinkHole(document);

    expect(hole(document)).toBe(2);
    expect(opened(document)).toBe(1);
    // A primeira casa a levantar a relva é o canto de cima à esquerda.
    expect(tiles(document)[0].dataset.state).toBe("open");
    expect(tiles(document).filter((tile) => tile.dataset.state === "open")).toHaveLength(1);

    const first = boxes(document)[0];
    expect(first.querySelector(".score-strokes").textContent).toBe(String(total(document)));
    expect(["under", "par", "over"]).toContain(first.dataset.result);
    expect(boxes(document)[1].dataset.result).toBe("playing");
  });

  it("a água custa uma tacada e devolve a bola ao sítio de onde saiu", async () => {
    const document = openPage();
    await playRound(document, { upTo: 3 });

    expect(hole(document)).toBe(3);
    const before = pair(document, "ball");
    const strokesBefore = total(document);

    // No buraco do lago, a direito para cima é lago: a bola vai lá parar.
    await shoot(document, { angle: 270, force: 40 });

    expect(pair(document, "ball")).toEqual(before);
    expect(total(document)).toBe(strokesBefore + 2);
    expect(hole(document)).toBe(3);
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

  it("destapa a fotografia inteira e festeja com o nome da pessoa", async () => {
    const document = openPage();

    await playRound(document);

    expect(at(document, "solved")).toBe("1");
    expect(opened(document)).toBe(HOLES);
    tiles(document).forEach((tile) => expect(tile.dataset.state).toBe("open"));
    expect(document.querySelector("#turf").classList.contains("solved")).toBe(true);
    // Já não se bate mais: a volta acabou.
    expect(document.querySelector("#shootButton").disabled).toBe(true);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain("nove buracos");
    expect(text).toContain(`${total(document)} tacadas`);

    // A fotografia fica um bocado à vista antes de a festa entrar.
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
    // O cartão da festa leva a fotografia consigo, para não a tapar por completo.
    expect(document.querySelector(".celebration-photo")).not.toBeNull();
    expect(html).toMatch(/\.celebration-photo\s*\{[^}]*photo\.jpg/);
  }, 40000);

  it("fecha a festa com a tecla Escape e recomeça a volta de campo fechado", async () => {
    const document = openPage();
    await playRound(document);
    await new Promise((done) => dom.window.setTimeout(done, PARTY_DELAY));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);

    click(document, "playAgainButton");

    expect(hole(document)).toBe(1);
    expect(opened(document)).toBe(0);
    expect(total(document)).toBe(0);
    expect(at(document, "solved")).toBeUndefined();
    tiles(document).forEach((tile) => expect(tile.dataset.state).toBe("grass"));
    boxes(document).forEach((box) => expect(box.querySelector(".score-strokes").textContent).toBe("–"));
    expect(document.querySelector("#shootButton").disabled).toBe(false);
  }, 40000);
});
