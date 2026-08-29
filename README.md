# Puzzles de aniversário

Um puzzle por pessoa, pensado primeiro para telemóvel e publicado através do GitHub Pages.
Cada pessoa tem o seu jogo: uns são puzzles deslizantes, outros são de encaixe (jigsaw),
outros de rotação — as peças ficam no sítio certo, mas tortas — e outros são tangrams.
Há ainda histórias de arrastar, em que cenários e personagens formam tiras de banda
desenhada, um Tetris em que cada peça que assenta destapa uma parte da fotografia,
um minigolfe em que cada buraco fechado levanta a relva de um bocado dela,
um golfe deslizante, em que a bola nunca pára a meio e a relva se levanta por
onde ela passa, um
Pac-Man de super-heróis em que cada pastilha comida acende a casa por onde passou,
e um jogo das caixinhas para dois em que cada caixa fechada destapa a fotografia
de quem a fechou.

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
| Diogo & Bernardo | Pac-Man de 104 pastilhas | [`puzzles/diogo-bernardo/`](puzzles/diogo-bernardo/index.html) | [`diogo-bernardo.test.js`](puzzles/diogo-bernardo/diogo-bernardo.test.js) |
| Filipe & Francisco | Caixinhas de 4 × 6 | [`puzzles/filipe-francisco/`](puzzles/filipe-francisco/index.html) | [`filipe-francisco.test.js`](puzzles/filipe-francisco/filipe-francisco.test.js) |
| Manuel Gomes | Golfe deslizante de 9 buracos | [`puzzles/manuel-gomes/`](puzzles/manuel-gomes/index.html) | [`manuel-gomes.test.js`](puzzles/manuel-gomes/manuel-gomes.test.js) |

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

O golfe do Manuel é um puzzle e não tem física nenhuma: nove tabuleiros de
6 × 6, escritos casa a casa na constante `HOLES` — `.` é relva, `T` uma árvore,
`S` areia, `~` água, `O` o copo e `B` o sítio de onde a bola parte, tal como o
labirinto do Pac-Man. Joga-se com as quatro setas, com o teclado, ou arrastando
o dedo por cima do campo para o lado a que se quer mandar a bola.

A regra é uma só: **a bola desliza até bater em alguma coisa e nunca pára a meio
do caminho**. É daí que vem o puzzle — são as árvores que dizem onde a bola pode
ficar, e chegar ao copo é encontrar a ordem certa das quatro setas. A areia
agarra-a na primeira casa que ela pisa, a água custa uma tacada e manda-a para
trás, e o copo apanha-a de passagem, sem ser preciso parar em cima dele. Bater
contra o que está encostado não conta tacada nenhuma.

O par não está escrito em lado nenhum: a página resolve cada buraco à largura e
o par é o caminho mais curto que encontrar. Os testes fazem a mesma conta por si,
lendo o tabuleiro tal como ele está desenhado na página, e confirmam que os dois
chegam ao mesmo número — 2, 3, 3, 4, 4, 4, 5, 5, 5, que dá 35 no campo todo.
Nenhum dos nove tem beco: de qualquer casa onde a bola pare, o copo continua a
poder ser alcançado, e por isso nunca é preciso recomeçar o buraco.

O tabuleiro e a fotografia são a mesma grelha de 36 casas: a relva levanta-se
por onde a bola passa, e é o rasto das voltas — certas e erradas — que vai
destapando a fotografia. Fechados os nove buracos, levanta-se o que sobrar.

O Pac-Man é o único puzzle de duas pessoas, e a página é uma capa de banda
desenhada: contornos grossos, sombras duras e o balão de estrela que salta a cada
poder. O labirinto está escrito casa a casa na constante `MAZE` — `#` é parede,
`-` é a porta do covil, `.` é pastilha, `o` é uma pastilha de poder e o espaço é o
chão do covil. São 12 × 18 casas (2 : 3, tal como a fotografia), e as duas pontas
da linha do meio estão abertas: é o túnel que dá a volta ao tabuleiro.

Cada pastilha comida levanta a tinta da casa onde estava, e é assim que a
fotografia aparece — com a forma do labirinto. Comidas as 104, caem também as
paredes e a fotografia fica inteira.

Só um dos dois heróis está em campo de cada vez: cada pastilha de poder passa o
turno ao outro **e** põe os quatro vilões em fuga, por isso vale a pena guardá-las
para quando eles apertam. Os vilões não sorteiam nada — um vai a direito atrás do
herói, outro corta-lhe o caminho quatro casas à frente, outro apanha-o pelo lado
oposto ao do primeiro, e o último só se atreve quando o herói está a mais de
`SHY_RANGE` casas. Andam três casas em cada quatro do herói, metade disso quando
fogem, e desatam a correr quando lhes sobram só os olhos a caminho do covil.

Perder não apaga nada: os três heróis voltam, o labirinto fica como estava e
continua-se de onde se ia.

As caixinhas são o jogo do caderno da escola, e são o segundo puzzle de duas
pessoas: pontos, riscos, e quem fecha o quarto lado de uma caixa fica com ela
**e joga outra vez** — é daí que vêm as cadeias e a vontade de dar duas caixas
para ganhar oito. O campo tem `COLS` × `ROWS` caixas, e 4 × 6 é 2 : 3, tal como
as fotografias: dá 24 caixas, 58 riscos e 35 pontos.

O que muda para o jogo do papel é o que está por baixo. Cada caixa fechada
destapa esse bocado da fotografia de quem a fechou, e como as duas fotografias
estão cortadas na mesma grelha — e as duas pessoas enquadradas da mesma maneira —
o mosaico que cresce é uma quimera, metade dragão, metade estátua. O território
de cada um é o resultado: não é preciso ler o placar para saber quem vai ganhando.
Fechadas as 24, caem os riscos e os pontos e fica só o mosaico, uns segundos à
vista antes de a festa entrar.

Não há sorteio nenhum: no primeiro jogo começa o Filipe, e o botão de novo jogo
passa a estreia ao outro. Cada risco é um botão com uma barra fina mas com 26 px
de área de toque, para caber num dedo sem enganos.

Esta pasta tem três fotografias em vez de uma: `photo-a.jpg` e `photo-b.jpg` são
as que o campo destapa, e `photo.jpg` é o retrato dos dois que a página inicial
mostra no seu círculo.

## Testes

```bash
npm install
npm test          # corre os testes de todos os puzzles
npm run test:watch
```

Os testes correm as páginas a sério, num browser simulado ([jsdom](https://github.com/jsdom/jsdom)):
baralham as peças, jogam o puzzle até ao fim e confirmam que a festa final aparece com o
nome certo. Cada ficheiro de testes é autónomo — não importa nada de outro puzzle.
