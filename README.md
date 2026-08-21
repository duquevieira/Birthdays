# Puzzles de aniversário

Um puzzle por pessoa, pensado primeiro para telemóvel e publicado através do GitHub Pages.
Cada pessoa tem o seu jogo: uns são puzzles deslizantes, outros são de encaixe (jigsaw),
outros de rotação — as peças ficam no sítio certo, mas tortas — e outros são tangrams.
Há ainda histórias de arrastar, em que cenários e personagens formam tiras de banda
desenhada, um Tetris em que cada peça que assenta destapa uma parte da fotografia, e
um minigolfe em que cada buraco fechado levanta a relva de um bocado dela.

A página inicial ([`index.html`](index.html)) é apenas um índice com as ligações para cada puzzle.

A pré-visualização das ligações (a imagem que o WhatsApp mostra) vive em
`assets/og-image.jpg` para a página inicial e em `assets/og-image.jpg` dentro da
pasta de cada pessoa. Os testes verificam que existem e que os cartões `og:`
apontam para elas por endereço absoluto.

## Estrutura

Cada puzzle vive numa pasta só sua — o nome da pasta é o nome da pessoa em minúsculas
e com hífen, porque é ele que aparece no endereço. Lá dentro está tudo o que a página
precisa: a própria página, as imagens e os testes.

```
puzzles/
└── ines-ferreira/
    ├── index.html               # a página, sem dependências: abre-se num browser
    ├── ines-ferreira.test.js    # todos os testes deste puzzle
    └── assets/
        ├── photo.jpg            # a fotografia que se transforma em puzzle (quadrada)
        ├── favicon.png          # o ícone do separador (64 × 64)
        └── og-image.jpg         # a pré-visualização das ligações (1200 × 630)
```

Nenhuma página vai buscar ficheiros fora da sua pasta, por isso os puzzles nunca
se estragam uns aos outros — e um teste de cada suite verifica exactamente isso.

## Puzzles

| Pessoa | Jogo | Página | Testes |
| --- | --- | --- | --- |
| Inês Ferreira | Deslizante 3 × 3 | [`puzzles/ines-ferreira/`](puzzles/ines-ferreira/index.html) | [`ines-ferreira.test.js`](puzzles/ines-ferreira/ines-ferreira.test.js) |
| Pedro Fernandes | Encaixe (jigsaw) 4 × 4 | [`puzzles/pedro-fernandes/`](puzzles/pedro-fernandes/index.html) | [`pedro-fernandes.test.js`](puzzles/pedro-fernandes/pedro-fernandes.test.js) |
| Inês Arbués | Rotação 3 × 3 | [`puzzles/ines-arbues/`](puzzles/ines-arbues/index.html) | [`ines-arbues.test.js`](puzzles/ines-arbues/ines-arbues.test.js) |
| Catarina Brito | Tangram de 7 peças | [`puzzles/catarina-brito/`](puzzles/catarina-brito/index.html) | [`catarina-brito.test.js`](puzzles/catarina-brito/catarina-brito.test.js) |
| Catarina Silva | A festa da Cat em 3 tiras | [`puzzles/catarina-silva/`](puzzles/catarina-silva/index.html) | [`catarina-silva.test.js`](puzzles/catarina-silva/catarina-silva.test.js) |
| Maria Vasconcelos | Tetris de 10 linhas | [`puzzles/maria-vasconcelos/`](puzzles/maria-vasconcelos/index.html) | [`maria-vasconcelos.test.js`](puzzles/maria-vasconcelos/maria-vasconcelos.test.js) |
| João Freitas | Minigolfe de 9 buracos | [`puzzles/joao-freitas/`](puzzles/joao-freitas/index.html) | [`joao-freitas.test.js`](puzzles/joao-freitas/joao-freitas.test.js) |

## Acrescentar uma pessoa

1. Copiar a pasta do jogo que se quer: `cp -R puzzles/pedro-fernandes puzzles/maria-silva`
2. Substituir `assets/photo.jpg` (quadrada), `assets/favicon.png` e `assets/og-image.jpg`.
3. Em `index.html`, mudar a constante `PUZZLE` (nome e mensagem), os textos
   visíveis e os endereços `canonical` / `og:` para `.../puzzles/maria-silva/`.
4. Mudar o nome do ficheiro de testes para `maria-silva.test.js` e as constantes
   `PERSON` e `SLUG` no topo do ficheiro.
5. Acrescentar a pessoa à lista da página inicial e à tabela deste README.

Nos puzzles de encaixe e de rotação, a dificuldade está na constante `SIZE`
(4 = 16 peças). No de rotação, cada peça fica no seu lugar e só muda de ângulo:
um toque roda-a um quarto de volta, e o jogo acaba quando estão todas direitas.

O tangram é o de sempre — dois triângulos grandes, um médio, dois pequenos, um
quadrado e um paralelogramo — desenhado na constante `PIECES` num quadrado de
4 × 4 unidades. A fotografia entra inteira em cada peça e é o recorte que mostra
só o bocado dela, por isso as peças casam ao milímetro quando assentam na caixa.

A caixa não tem risco nenhum: os lugares certos existem no código mas não se
vêem, e a única pista é o bocado de fotografia que cada peça leva. Nenhuma peça
começa direita — o primeiro toque pega nela, os seguintes rodam-na `STEP` graus —
e só assenta se for largada a menos de `TOLERANCE` do sítio dela **e** estiver
direita: a forma até encaixaria de lado, mas a fotografia ficaria virada.

O Tetris joga-se num poço de `COLS` × `ROWS` que tem a forma da fotografia (8 × 12
é 2 : 3, tal como ela), por isso cada casa mostra o seu pedaço sem esticar nada:
as peças a cair são da sua cor, e ao assentarem destapam a fotografia por baixo.
Ganha-se ao fim de `GOAL` linhas, e aí o poço inteiro passa a fotografia: fica uns
segundos à vista antes de a festa entrar, e vai também dentro do cartão. As sete
peças não têm tabela de rotação nenhuma — cada uma é uma lista de casas dentro de
uma caixa quadrada, e rodar é girar a caixa. Joga-se com os botões, com as setas
do teclado, ou com o dedo por cima do poço: arrastar para o lado move, arrastar
para baixo larga a peça, e um toque roda-a. O botão grande começa o jogo e, daí
em diante, é o de pausa.

O minigolfe joga-se no mesmo quadrado da fotografia: por baixo está ela, por cima
os nove bocados de relva que a tapam, e cada buraco fechado levanta um. O campo
mede sempre 100 × 100, seja qual for o ecrã, e é nessas unidades que estão escritos
a bola, o copo e os obstáculos de cada um dos buracos da constante `HOLES`.

A bola trava a um ritmo constante, como na relva, e por isso a distância de uma
tacada é só velocidade² / (2 × `TRAVAGEM`): a mesma força faz sempre o mesmo
caminho. Cada tacada resolve-se toda de uma vez — o caminho fica guardado ponto a
ponto e só depois é que a bola o percorre no ecrã —, por isso o que se vê é
exactamente o que a física deu, sem depender do ritmo do desenho. Todos os buracos
têm uma linha directa da bola até ao copo: as paredes, a areia e a água castigam a
pontaria torta, não a certeira. Puxa-se a bola para trás e larga-se, como no
minigolfe a sério, ou afina-se com as setas e o cursor da força.

## Testes

```bash
npm install
npm test          # corre os testes de todos os puzzles
npm run test:watch
```

Os testes correm as páginas a sério, num browser simulado ([jsdom](https://github.com/jsdom/jsdom)):
baralham as peças, jogam o puzzle até ao fim e confirmam que a festa final aparece com o
nome certo. Cada ficheiro de testes é autónomo — não importa nada de outro puzzle.
