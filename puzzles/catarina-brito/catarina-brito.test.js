// Todos os testes do puzzle da Catarina — um tangram de 7 peças. O ficheiro é
// autónomo: não importa nada de outros puzzles, para que cada pasta possa ser
// copiada tal como está.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Catarina";
const SLUG = "catarina-brito";
const TOTAL = 7;
const UNIT = 4;              // o quadrado do tangram tem 4 unidades de lado

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

function openPage({ seed = 20260814 } = {}) {
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

/** As peças que ainda estão por pôr, pela ordem em que aparecem na tábua. */
const trayOrder = (document) =>
  [...document.querySelectorAll(".piece")].map((piece) => Number(piece.dataset.piece));

const pieceButton = (document, piece) => document.querySelector(`.piece[data-piece="${piece}"]`);
const slotButton = (document, slot) => document.querySelector(`.slot[data-slot="${slot}"]`);
const placedPieces = (document) =>
  [...document.querySelectorAll(".placed-piece")].map((held) => Number(held.dataset.placed));

/** Os cantos da peça, lidos do recorte do seu desenho: "M 0 0 L 4 0 L 2 2 Z". */
function cornersOfPiece(document, piece) {
  const shape = pieceButton(document, piece).querySelector("clipPath path").getAttribute("d");
  return shape
    .replace(/^M\s*/, "")
    .replace(/\s*Z$/, "")
    .split("L")
    .map((corner) => corner.trim().split(/\s+/).map(Number));
}

/** Os mesmos cantos, lidos do recorte do lugar na caixa: "polygon(0% 0%, ...)". */
function cornersOfSlot(document, slot) {
  const polygon = slotButton(document, slot).style.clipPath;
  return polygon
    .slice("polygon(".length, -1)
    .split(",")
    .map((corner) => corner.trim().split(/\s+/).map((value) => (parseFloat(value) * UNIT) / 100));
}

/** Fórmula do sapateiro: a área de um polígono a partir dos seus cantos. */
const areaOf = (corners) =>
  Math.abs(
    corners.reduce((total, [x, y], index) => {
      const [nextX, nextY] = corners[(index + 1) % corners.length];
      return total + x * nextY - nextX * y;
    }, 0),
  ) / 2;

/** Os comprimentos dos lados, arredondados, para reconhecer a forma da peça. */
const sidesOf = (corners) =>
  corners.map(([x, y], index) => {
    const [nextX, nextY] = corners[(index + 1) % corners.length];
    return Number(Math.hypot(nextX - x, nextY - y).toFixed(3));
  });

/** Pega na peça (se ainda não estiver na mão) e põe-na num lugar da caixa. */
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

describe(`Puzzle da ${PERSON} — as sete peças do tangram`, () => {
  it("dá sete peças por pôr e sete lugares vazios", () => {
    const document = openPage();

    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".slot")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".placed-piece")).toHaveLength(0);
    expect(trayOrder(document).slice().sort((a, b) => a - b)).toEqual([...Array(TOTAL).keys()]);
    expect(document.querySelector("#placedCount").textContent).toBe(`0/${TOTAL}`);
  });

  it("é mesmo o tangram: dois triângulos grandes, um médio, dois pequenos, um quadrado e um paralelogramo", () => {
    const document = openPage();
    const shapes = [...Array(TOTAL).keys()].map((piece) => {
      const corners = cornersOfPiece(document, piece);
      return { corners: corners.length, area: areaOf(corners), sides: sidesOf(corners) };
    });

    const areas = shapes.map((shape) => shape.area).sort((a, b) => a - b);
    expect(areas).toEqual([1, 1, 2, 2, 2, 4, 4]);

    const triangles = shapes.filter((shape) => shape.corners === 3);
    const quadrilaterals = shapes.filter((shape) => shape.corners === 4);
    expect(triangles).toHaveLength(5);
    expect(quadrilaterals).toHaveLength(2);

    // Os cinco triângulos são rectângulos isósceles, em três tamanhos: os dois
    // grandes com catetos 2√2, o médio com catetos 2 e os dois pequenos com √2.
    const legs = triangles.map((shape) => Math.min(...shape.sides)).sort((a, b) => a - b);
    expect(legs).toEqual([1.414, 1.414, 2, 2.828, 2.828]);

    // O quadrado tem os quatro lados iguais; o paralelogramo tem-nos dois a dois.
    const square = quadrilaterals.find((shape) => new Set(shape.sides).size === 1);
    const parallelogram = quadrilaterals.find((shape) => new Set(shape.sides).size === 2);
    expect(square.sides).toEqual([1.414, 1.414, 1.414, 1.414]);
    expect(parallelogram.sides.slice().sort()).toEqual([1.414, 1.414, 2, 2]);
  });

  it("as peças enchem o quadrado todo, sem folgas nem sobreposições", () => {
    const document = openPage();
    const pieces = [...Array(TOTAL).keys()].map((piece) => cornersOfPiece(document, piece));

    // A soma das áreas é a do quadrado inteiro — nenhuma peça sobra nem falta.
    const total = pieces.reduce((sum, corners) => sum + areaOf(corners), 0);
    expect(total).toBe(UNIT * UNIT);

    // E nenhum canto sai fora do quadrado.
    pieces.flat().forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(UNIT);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(UNIT);
    });
  });

  it("recorta cada lugar da caixa com a forma exacta da sua peça", () => {
    const document = openPage();

    [...Array(TOTAL).keys()].forEach((piece) => {
      // O lugar é um botão que ocupa a caixa toda e é recortado com a forma da
      // peça: é o recorte que decide onde é que o dedo tem mesmo de cair.
      expect(cornersOfSlot(document, piece)).toEqual(cornersOfPiece(document, piece));
    });
  });

  it("recorta cada peça num bocado diferente da mesma fotografia", () => {
    const document = openPage();
    const clipIds = new Set();
    const windows = new Set();

    document.querySelectorAll(".piece svg").forEach((svg) => {
      const clip = svg.querySelector("clipPath");
      const image = svg.querySelector("image");

      // A fotografia entra sempre inteira e no mesmo sítio; o que muda de peça
      // para peça é o recorte e a janela por onde se olha (o viewBox).
      expect(image.getAttribute("href")).toBe("./assets/photo.jpg");
      expect(image.getAttribute("x")).toBe("0");
      expect(image.getAttribute("y")).toBe("0");
      expect(Number(image.getAttribute("width"))).toBe(UNIT);
      expect(image.getAttribute("clip-path")).toBe(`url(#${clip.id})`);

      clipIds.add(clip.id);
      windows.add(svg.getAttribute("viewBox"));
    });

    expect(clipIds.size).toBe(TOTAL);
    expect(windows.size).toBe(TOTAL);
  });

  it("dá a cada peça na tábua o seu tamanho verdadeiro", () => {
    const document = openPage();

    [...Array(TOTAL).keys()].forEach((piece) => {
      const corners = cornersOfPiece(document, piece);
      const xs = corners.map(([x]) => x);
      const ys = corners.map(([, y]) => y);
      const button = pieceButton(document, piece);

      // --w e --h são a fracção do quadrado que a peça ocupa: é o que faz o
      // triângulo grande aparecer maior do que o pequeno, também na tábua.
      expect(Number(button.style.getPropertyValue("--w"))).toBeCloseTo((Math.max(...xs) - Math.min(...xs)) / UNIT);
      expect(Number(button.style.getPropertyValue("--h"))).toBeCloseTo((Math.max(...ys) - Math.min(...ys)) / UNIT);
      expect(button.style.getPropertyValue("--tilt")).toMatch(/^-?\d+deg$/);
    });
  });

  it.each([1, 7, 42, 2026, 20260814])("baralha as peças (semente %i)", (seed) => {
    const document = openPage({ seed });
    expect(trayOrder(document)).not.toEqual([...Array(TOTAL).keys()]);
  });

  it("põe a peça no lugar certo", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];

    dropPieceOn(document, piece, piece);

    expect(placedPieces(document)).toEqual([piece]);
    expect(pieceButton(document, piece)).toBe(null);
    expect(document.querySelectorAll(".piece")).toHaveLength(TOTAL - 1);
    expect(slotButton(document, piece).classList.contains("is-filled")).toBe(true);
    expect(document.querySelector("#placedCount").textContent).toBe(`1/${TOTAL}`);
    // Na caixa, a peça mostra o quadrado inteiro: é assim que casa com as outras.
    expect(document.querySelector(".placed-piece svg").getAttribute("viewBox")).toBe(`0 0 ${UNIT} ${UNIT}`);
  });

  it("não deixa pôr a peça no lugar errado", () => {
    const document = openPage();
    const piece = trayOrder(document)[0];
    const wrongSlot = (piece + 3) % TOTAL;

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

    // Sem peça na mão, tocar no lugar certo não põe nada.
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
    expect(document.querySelectorAll(".slot")).toHaveLength(TOTAL);
    expect(document.querySelectorAll(".placed-piece")).toHaveLength(0);
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

  it("festeja com o nome da pessoa quando a última peça assenta", async () => {
    const document = openPage();
    solve(document);

    expect(placedPieces(document).sort((a, b) => a - b)).toEqual([...Array(TOTAL).keys()]);
    expect(document.querySelectorAll(".piece")).toHaveLength(0);
    expect(document.querySelector("#placedCount").textContent).toBe(`${TOTAL}/${TOTAL}`);
    // Com o tangram feito, os cortes desaparecem e fica só a fotografia.
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
    dropPieceOn(document, first, (first + 2) % TOTAL);   // uma tentativa a mais
    solve(document);

    expect(document.querySelector("#celebrationText").textContent).toContain(`${TOTAL + 1} tentativas`);
  });

  it("ignora toques depois de o tangram estar feito", async () => {
    const document = openPage();
    solve(document);
    await new Promise((done) => dom.window.setTimeout(done, 1500));

    slotButton(document, 0).click();

    expect(placedPieces(document)).toHaveLength(TOTAL);
    expect(document.querySelector("#placedCount").textContent).toBe(`${TOTAL}/${TOTAL}`);
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
