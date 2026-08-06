// Todos os testes do puzzle da Inês Arbués. O ficheiro é autónomo: não importa
// nada de outros puzzles, para que cada pasta possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Inês";
const SLUG = "ines-arbues";
const SIZE = 3;
const TILES = SIZE * SIZE;

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

let dom = null;

/** Gerador determinista, para que o baralhar das peças seja sempre o mesmo. */
function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function openPage({ seed = 20260806 } = {}) {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
    beforeParse(window) {
      window.Math.random = seededRandom(seed);
    },
  });
  return dom.window.document;
}

/** O tabuleiro tal como está desenhado: quantos quartos de volta falta desfazer. */
function readRotations(document) {
  return [...document.querySelectorAll(".tile")].map((tile) => Number(tile.dataset.rotation));
}

function clickTile(document, index) {
  document.querySelectorAll(".tile")[index].click();
}

const isSolved = (rotations) => rotations.every((turns) => turns === 0);

/** Cada peça precisa de tantos toques quantos os quartos de volta que lhe faltam. */
const movesNeeded = (rotations) => rotations.reduce((total, turns) => total + ((4 - turns) % 4), 0);

function solve(document) {
  const rotations = readRotations(document);
  rotations.forEach((turns, index) => {
    for (let click = 0; click < (4 - turns) % 4; click += 1) clickTile(document, index);
  });
  return movesNeeded(rotations);
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe(`Puzzle da ${PERSON} — página`, () => {
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

describe(`Puzzle da ${PERSON} — tabuleiro`, () => {
  it("desenha nove peças, cada uma com o seu pedaço da fotografia", () => {
    const document = openPage();
    const tiles = document.querySelectorAll(".tile");

    expect(tiles).toHaveLength(TILES);
    const corners = [...tiles].map((tile) => tile.style.backgroundPosition);
    expect(new Set(corners).size).toBe(TILES);
    expect(corners[0]).toBe("0% 0%");
    expect(corners[TILES - 1]).toBe("100% 100%");
  });

  it.each([1, 7, 42, 2026, 20260806])(
    "baralha as peças deixando pelo menos metade tortas (semente %i)",
    (seed) => {
      const document = openPage({ seed });
      const rotations = readRotations(document);

      expect(rotations).toHaveLength(TILES);
      expect(rotations.every((turns) => turns >= 0 && turns <= 3)).toBe(true);
      expect(isSolved(rotations)).toBe(false);
      expect(rotations.filter((turns) => turns !== 0).length).toBeGreaterThanOrEqual(Math.ceil(TILES / 2));
    },
  );

  it("roda a peça um quarto de volta a cada toque e conta a jogada", () => {
    const document = openPage();
    const before = readRotations(document);
    const target = before.findIndex((turns) => turns !== 0);

    clickTile(document, target);

    expect(readRotations(document)[target]).toBe((before[target] + 1) % 4);
    expect(document.querySelectorAll(".tile")[target].style.transform).toBe(
      `rotate(${(before[target] + 1) * 90}deg)`,
    );
    expect(document.querySelector("#moveCount").textContent).toBe("1");
  });

  it("roda sempre para o mesmo lado, mesmo ao dar a volta completa", () => {
    const document = openPage();
    const tile = document.querySelectorAll(".tile")[0];
    const angleOf = () => Number(tile.style.transform.match(/-?[\d.]+/)[0]);
    // O ângulo desenhado nunca pode recuar: ao passar de 270° para 0°, a peça
    // daria três quartos de volta para trás em vez de um quarto para a frente.
    let previous = angleOf();

    for (let click = 0; click < 8; click += 1) {
      clickTile(document, 0);
      expect(angleOf()).toBe(previous + 90);
      previous = angleOf();
    }

    // O estado continua a contar-se em quartos de volta, de 0 a 3.
    expect(readRotations(document)[0]).toBeLessThanOrEqual(3);
  });

  it("deixa as outras peças quietas", () => {
    const document = openPage();
    const before = readRotations(document);

    clickTile(document, 0);

    const after = readRotations(document);
    expect(after.filter((_, index) => index !== 0)).toEqual(before.filter((_, index) => index !== 0));
  });

  it("devolve a peça ao ângulo inicial ao fim de quatro toques", () => {
    const document = openPage();
    const before = readRotations(document);
    // O caso limite da rotação: quatro quartos de volta são uma volta inteira.
    for (let click = 0; click < 4; click += 1) clickTile(document, 1);

    expect(readRotations(document)[1]).toBe(before[1]);
    expect(document.querySelector("#moveCount").textContent).toBe("4");
  });

  it("volta ao início quando se baralha outra vez", () => {
    const document = openPage();
    clickTile(document, 0);
    expect(document.querySelector("#moveCount").textContent).toBe("1");

    document.querySelector("#shuffleButton").click();

    expect(document.querySelector("#moveCount").textContent).toBe("0");
    expect(document.querySelector("#timer").textContent).toBe("0:00");
    expect(isSolved(readRotations(document))).toBe(false);
  });
});

describe(`Puzzle da ${PERSON} — fotografia e final`, () => {
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

  it("festeja com o nome da pessoa quando a fotografia fica direita", async () => {
    const document = openPage();
    const moves = solve(document);

    expect(isSolved(readRotations(document))).toBe(true);
    expect(document.querySelector("#moveCount").textContent).toBe(String(moves));
    expect(document.querySelector("#puzzle").classList.contains("solved")).toBe(true);
    expect([...document.querySelectorAll(".tile")].every((tile) => tile.disabled)).toBe(true);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain(`${moves} jogadas`);

    await new Promise((done) => dom.window.setTimeout(done, 800));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
  });

  it("ignora toques depois de a fotografia estar direita", async () => {
    const document = openPage();
    const moves = solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 800));

    clickTile(document, 0);

    expect(isSolved(readRotations(document))).toBe(true);
    expect(document.querySelector("#moveCount").textContent).toBe(String(moves));
  });

  it("fecha a festa com a tecla Escape", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 800));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  });

  it("recomeça o jogo a partir da festa", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 800));

    document.querySelector("#playAgainButton").click();

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(document.querySelector("#moveCount").textContent).toBe("0");
    expect(isSolved(readRotations(document))).toBe(false);
  });
});
