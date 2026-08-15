import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const PERSON = "Catarina Silva";
const SLUG = "catarina-silva";
const PAGE_URL = `https://duquevieira.github.io/Birthdays/puzzles/${SLUG}/`;
const puzzleDir = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(resolve(puzzleDir, "index.html"), "utf8");

const people = ["cat", "mickael", "maggie", "sarah"];
const sets = ["volleyball", "soccer", "board-games"];

let dom = null;

function openPage() {
  dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: PAGE_URL,
  });
  return dom.window.document;
}

function puzzle() {
  return dom.window.storyPuzzle;
}

function drop(kind, value, strip) {
  puzzle().dropItem(kind, value, strip);
}

function fill(strip, set, first, second) {
  drop("set", set, strip);
  drop("character", first, strip);
  drop("character", second, strip);
}

function castImages(document, strip) {
  return [...document.querySelectorAll(`.strip[data-strip="${strip}"] .cast-member img`)].map((image) => image.getAttribute("src"));
}

afterEach(() => {
  dom?.window.close();
  dom = null;
});

describe(`Puzzle da ${PERSON} — página`, () => {
  it("anuncia a Catarina Silva no título e celebra a Cat no cabeçalho", () => {
    const document = openPage();
    expect(document.title).toContain(PERSON);
    expect(document.querySelector("h1").textContent).toContain("Cat");
    expect(document.body.textContent).not.toMatch(/story teller/i);
    expect(document.querySelector(".orientation-tip").textContent).toMatch(/horizontal/i);
  });

  it("aponta os cartões públicos para a pasta do próprio puzzle", () => {
    const document = openPage();
    expect(document.querySelector('link[rel="canonical"]').href).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:url"]').content).toBe(PAGE_URL);
    expect(document.querySelector('meta[property="og:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
    expect(document.querySelector('meta[name="twitter:image"]').content).toBe(`${PAGE_URL}assets/og-image.jpg`);
  });

  it("tem todos os retratos e cenários pedidos", () => {
    expect(existsSync(resolve(puzzleDir, "assets/photo.jpg"))).toBe(true);
    expect(existsSync(resolve(puzzleDir, "assets/favicon.png"))).toBe(true);
    expect(existsSync(resolve(puzzleDir, "assets/og-image.jpg"))).toBe(true);

    sets.forEach((set) => {
      expect(existsSync(resolve(puzzleDir, `assets/sets/${set}.webp`))).toBe(true);
    });
    people.forEach((person) => {
      expect(existsSync(resolve(puzzleDir, `assets/characters/${person}-neutral.webp`))).toBe(true);
      sets.forEach((set) => {
        ["happy", "furious"].forEach((emotion) => {
          expect(existsSync(resolve(puzzleDir, `assets/characters/${person}-${set}-${emotion}.webp`))).toBe(true);
        });
      });
    });
  });

  it("é autónoma: não usa caminhos para fora da sua pasta", () => {
    expect(html).not.toContain("../");
    const document = openPage();
    document.querySelectorAll("script[src], link[href], img[src]").forEach((element) => {
      const reference = element.getAttribute("src") ?? element.getAttribute("href");
      expect(reference.startsWith("./") || /^https?:\/\//.test(reference)).toBe(true);
    });
  });
});

describe(`Puzzle da ${PERSON} — tabuleiro`, () => {
  it("começa com três tiras vazias, quatro personagens e três cenários", () => {
    const document = openPage();
    expect(document.querySelectorAll(".strip")).toHaveLength(3);
    expect(document.querySelectorAll(".character-token")).toHaveLength(4);
    expect(document.querySelectorAll(".scene-token")).toHaveLength(3);
    expect([...document.querySelectorAll(".source-token")].every((token) => token.draggable === false)).toBe(true);
    expect(puzzle().strips).toEqual([
      { set: null, characters: [] },
      { set: null, characters: [] },
      { set: null, characters: [] },
    ]);
  });

  it("remove sempre a miniatura de arrastar quando o gesto é cancelado", () => {
    const document = openPage();
    document.elementFromPoint = () => null;
    const cat = document.querySelector('.character-token[data-value="cat"]');

    cat.dispatchEvent(new dom.window.MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    document.dispatchEvent(new dom.window.MouseEvent("pointermove", { bubbles: true, clientX: 40, clientY: 40 }));
    expect(document.querySelector(".drag-ghost")).not.toBe(null);

    document.dispatchEvent(new dom.window.MouseEvent("pointercancel", { bubbles: true }));
    expect(document.querySelector(".drag-ghost")).toBe(null);
  });

  it("move um cenário para a nova tira e substitui o que já lá estava", () => {
    openPage();
    drop("set", "volleyball", 0);
    drop("set", "soccer", 0);
    expect(puzzle().strips[0].set).toBe("soccer");

    drop("set", "soccer", 2);
    expect(puzzle().strips[0].set).toBe(null);
    expect(puzzle().strips[2].set).toBe("soccer");
  });

  it("só deixa a Cat repetir entre tiras", () => {
    openPage();
    drop("character", "cat", 0);
    drop("character", "cat", 1);
    expect(puzzle().strips[0].characters).toContain("cat");
    expect(puzzle().strips[1].characters).toContain("cat");

    drop("character", "sarah", 0);
    drop("character", "sarah", 2);
    expect(puzzle().strips[0].characters).not.toContain("sarah");
    expect(puzzle().strips[2].characters).toContain("sarah");
  });

  it("impede duplicados e substitui o parceiro quando a tira já tem duas pessoas", () => {
    openPage();
    drop("character", "cat", 0);
    drop("character", "cat", 0);
    expect(puzzle().strips[0].characters).toEqual(["cat"]);

    drop("character", "maggie", 0);
    drop("character", "sarah", 0);
    expect(puzzle().strips[0].characters).toEqual(["cat", "sarah"]);
    expect(puzzle().strips[0].characters).toHaveLength(2);
  });

  it("mostra as duas personagens furiosas numa combinação errada", () => {
    const document = openPage();
    fill(0, "soccer", "cat", "maggie");
    expect(document.querySelector('.strip[data-strip="0"]').dataset.result).toBe("wrong");
    expect(puzzle().soundEvents.at(-1)).toBe("failed");
    expect(castImages(document, 0)).toEqual([
      "./assets/characters/cat-soccer-furious.webp",
      "./assets/characters/maggie-soccer-furious.webp",
    ]);
  });

  it("mostra a Cat feliz e a outra personagem furiosa numa combinação certa", () => {
    const document = openPage();
    fill(0, "volleyball", "cat", "maggie");
    expect(document.querySelector('.strip[data-strip="0"]').dataset.result).toBe("correct");
    expect(puzzle().soundEvents.at(-1)).toBe("correct");
    expect(castImages(document, 0)).toEqual([
      "./assets/characters/cat-volleyball-happy.webp",
      "./assets/characters/maggie-volleyball-furious.webp",
    ]);
  });

  it("aceita as três soluções em qualquer ordem e festeja sem tapar as tiras", () => {
    const document = openPage();
    fill(0, "board-games", "mickael", "cat");
    fill(1, "volleyball", "maggie", "cat");
    fill(2, "soccer", "sarah", "cat");

    expect(document.querySelector("#correctCount").textContent).toBe("3");
    expect(document.querySelector("#gameCard").classList.contains("won")).toBe(true);
    expect(document.querySelector("#winMessage").hidden).toBe(false);
    expect(document.querySelector("#pieceTray").hidden).toBe(false);
    expect(document.querySelector("#pieceTray").getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector("#winTitle").textContent).toContain("Cat");
    expect(document.querySelectorAll(".strip[data-result=\"correct\"]")).toHaveLength(3);
    expect(document.querySelector("[role=\"dialog\"]")).toBe(null);
    expect(puzzle().soundEvents.at(-1)).toBe("winning");
  });

  it("recomeça com as três tiras vazias", () => {
    const document = openPage();
    fill(0, "volleyball", "cat", "maggie");
    document.querySelector("#resetButton").click();
    expect(puzzle().strips.every((strip) => strip.set === null && strip.characters.length === 0)).toBe(true);
    expect(document.querySelector("#correctCount").textContent).toBe("0");
    expect(document.querySelector("#gameCard").classList.contains("won")).toBe(false);
    expect(document.querySelector("#winMessage").hidden).toBe(true);
    expect(document.querySelector("#pieceTray").hidden).toBe(false);
    expect(document.querySelector("#pieceTray").getAttribute("aria-hidden")).toBe("false");
  });
});
