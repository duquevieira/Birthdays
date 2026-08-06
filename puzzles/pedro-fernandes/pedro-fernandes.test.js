// Todos os testes do puzzle do Pedro — um puzzle de encaixe (jigsaw) de 4 × 4.
// O ficheiro é autónomo: não importa nada de outros puzzles, para que cada pasta
// possa ser copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "tio Pedro";
const SLUG = "pedro-fernandes";
const SIZE = 4;
const TOTAL = SIZE * SIZE;

const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;

const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

let dom = null;

/** Gerador determinista, para que as peças saiam sempre pela mesma ordem. */
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

/** As peças que ainda estão por encaixar, pela ordem em que aparecem. */
const trayOrder = (document) =>
  [...document.querySelectorAll(".piece")].map((piece) => Number(piece.dataset.piece));

const pieceButton = (document, piece) => document.querySelector(`.piece[data-piece="${piece}"]`);
const slotButton = (document, slot) => document.querySelector(`.slot[data-slot="${slot}"]`);
const placedPieces = (document) =>
  [...document.querySelectorAll(".placed-piece")].map((held) => Number(held.dataset.placed));

/** Pega na peça (se ainda não estiver na mão) e larga-a num lugar do tabuleiro. */
function dropPieceOn(document, piece, slot) {
  const button = pieceButton(document, piece);
  if (!button.classList.contains("is-selected")) button.click();
  slotButton(document, slot).click();
}

function solve(document) {
  trayOrder(document).forEach((piece) => dropPieceOn(document, piece, piece));
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

describe(`Puzzle do ${PERSON} — peças de encaixe`, () => {
  it("dá dezasseis peças por encaixar e dezasseis lugares vazios", () => {
    const document = openPage();

    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".slot")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".placed-piece")).toHaveLength(0);
    expect(trayOrder(document).slice().sort((a, b) => a - b)).toEqual([...Array(TOTAL).keys()]);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
  });

  it.each([1, 7, 42, 2026, 20260806])("baralha as peças (semente %i)", (seed) => {
    const document = openPage({ seed });
    expect(trayOrder(document)).not.toEqual([...Array(TOTAL).keys()]);
  });

  it("recorta cada peça num bocado diferente da mesma fotografia", () => {
    const document = openPage();
    const clipIds = new Set();
    const crops = new Set();

    document.querySelectorAll(".piece svg").forEach((svg) => {
      const clip = svg.querySelector("clipPath");
      const image = svg.querySelector("image");

      expect(image.getAttribute("href")).toBe("./assets/photo.jpg");
      // A fotografia entra inteira e é deslocada para deixar à vista só este bocado.
      expect(Number(image.getAttribute("width"))).toBe(SIZE * 100);
      expect(image.getAttribute("clip-path")).toBe(`url(#${clip.id})`);

      clipIds.add(clip.id);
      crops.add(`${image.getAttribute("x")},${image.getAttribute("y")}`);
    });

    expect(clipIds.size).toBe(TOTAL);
    expect(crops.size).toBe(TOTAL);
  });

  it("dá saliências e reentrâncias às peças do meio e arestas lisas na borda", () => {
    const document = openPage();
    const shapeOf = (piece) => pieceButton(document, piece).querySelector("clipPath path").getAttribute("d");

    // A peça do canto superior esquerdo tem duas arestas lisas (dois segmentos "L").
    expect(shapeOf(0).match(/L /g)).toHaveLength(2);
    // A do meio não tem nenhuma: as quatro arestas encaixam nas vizinhas.
    expect(shapeOf(SIZE + 1).match(/L /g)).toBe(null);
    expect(shapeOf(SIZE + 1)).toContain("C ");
  });

  it("encaixa a peça no lugar certo", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];

    dropPieceOn(document, piece, piece);

    expect(placedPieces(document)).toEqual([piece]);
    expect(pieceButton(document, piece)).toBe(null);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL - 1);
    expect(slotButton(document, piece).classList.contains("is-filled")).toBe(true);
    expect(document.querySelector("#placedCount").textContent).toBe(`1/${TOTAL}`);
  });

  it("não deixa encaixar a peça no lugar errado", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const wrongSlot = (piece + 5) % TOTAL;

    dropPieceOn(document, piece, wrongSlot);

    expect(placedPieces(document)).toEqual([]);
    expect(pieceButton(document, piece)).not.toBe(null);
    expect(slotButton(document, wrongSlot).classList.contains("is-filled")).toBe(false);
    expect(slotButton(document, wrongSlot).classList.contains("is-wrong")).toBe(true);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
  });

  it("não faz nada quando se toca num lugar sem peça na mão", () => {
    const document = openPage();

    slotButton(document, 0).click();

    expect(placedPieces(document)).toEqual([]);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
  });

  it("pousa a peça quando se toca nela outra vez", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];

    pieceButton(document, piece).click();
    expect(pieceButton(document, piece).classList.contains("is-selected")).toBe(true);

    pieceButton(document, piece).click();
    expect(pieceButton(document, piece).classList.contains("is-selected")).toBe(false);

    // Sem peça na mão, tocar no lugar certo não encaixa nada.
    slotButton(document, piece).click();
    expect(placedPieces(document)).toEqual([]);
  });

  it("volta ao início quando se baralha outra vez", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    dropPieceOn(document, piece, piece);
    expect(document.querySelector("#placedCount").textContent).toBe(`1/${TOTAL}`);

    document.querySelector("#shuffleButton").click();

    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
    expect(document.querySelector("#timer").textContent).toBe("0:00");
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".placed-piece")).toHaveLength(0);
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

  it("festeja com o nome da pessoa quando a última peça encaixa", async () => {
    const document = openPage();
    solve(document);

    expect(placedPieces(document).sort((a, b) => a - b)).toEqual([...Array(TOTAL).keys()]);
    expect(document.querySelectorAll(".piece")).toHaveLength(0);
    expect(document.querySelector("#placedCount").textContent).toBe(`${TOTAL}/${TOTAL}`);
    // Com o puzzle feito, os recortes desaparecem e fica só a fotografia.
    expect(document.querySelector("#board").classList.contains("is-solved")).toBe(true);

    const text = document.querySelector("#celebrationText").textContent;
    expect(text).toContain(PERSON);
    expect(text).toContain(`${TOTAL} tentativas`);

    await new Promise((done) => dom.window.setTimeout(done, 1500));
    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(true);
    expect(document.querySelector("#celebration").getAttribute("aria-hidden")).toBe("false");
  });

  it("conta as tentativas falhadas até ao fim", async () => {
    const document = openPage();
    const first = trayOrder(document)[0];
    dropPieceOn(document, first, (first + 3) % TOTAL);   // uma tentativa a mais
    solve(document);

    expect(document.querySelector("#celebrationText").textContent).toContain(`${TOTAL + 1} tentativas`);
  });

  it("fecha a festa com a tecla Escape", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 1500));

    document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
  });

  it("recomeça o jogo a partir da festa", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 1500));

    document.querySelector("#playAgainButton").click();

    expect(document.querySelector("#celebration").classList.contains("visible")).toBe(false);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelector("#board").classList.contains("is-solved")).toBe(false);
  });
});
