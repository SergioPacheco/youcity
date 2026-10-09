# STREET — Europa, lote 3

Curadoria em **2026-10-09**, continuando a preferência pela Europa registrada no [lote anterior](street-food-europe-2026-10-08.md). Este lote acrescenta **6 cidades, 18 pratos, 12 locais e 12 vídeos**, elevando o catálogo local de **61 para 67 cidades**. As 61 entradas presentes no início desta etapa foram preservadas integralmente.

Mantém o schema 1 e os slugs existentes em `data/catalog.json`. As descrições em inglês são redação editorial própria. Cada prato registra suas fontes e a data de consulta em `data/street-food.json`. Não são incluídos preços, horários nem alegações alimentares inferidas.

## Cobertura

| Cidade | Pratos | Locais |
| --- | --- | --- |
| `nice` | Socca, Pan bagnat, Pissaladière | Cours Saleya Market, Chez Pipo |
| `edinburgh` | Haggis, Cullen skink, Cranachan | Edinburgh Farmers’ Market, Stockbridge Market |
| `frankfurt` | Frankfurter Grüne Soße, Handkäs mit Musik, Frankfurter Würstchen | Kleinmarkthalle, Erzeugermarkt Konstablerwache |
| `ljubljana` | Kranjska klobasa, Štruklji, Potica | Ljubljana Central Market, Klobasarna |
| `zurich` | Zürcher Geschnetzeltes, Rösti, Luxemburgerli | Markthalle im Viadukt, Confiserie Sprüngli Paradeplatz |
| `thessaloniki` | Bougatsa, Koulouri Thessalonikis, Trigona Panoramatos | Kapani Market, Modiano Market |

## Fontes gastronômicas e vínculos local → prato

| Cidade | Fontes consultadas | Critério editorial |
| --- | --- | --- |
| Nice | [Socca](https://www.explorenicecotedazur.com/en/explore/art-of-living/gastronomy-and-local-produce/nicoise-recipes/la-socca/), [pan bagnat](https://www.explorenicecotedazur.com/en/explore/art-of-living/gastronomy-and-local-produce/nicoise-recipes/pan-bagnat/), [pissaladière](https://www.explorenicecotedazur.com/explorer/art-de-vivre/gastronomie-et-terroir/recettes-de-cuisine-nicoise/la-pissaladiere/), [Chez Pipo](https://www.chezpipo.fr/fr) | O site do restaurante confirma socca e pissaladière na unidade da Rue Bavastro. Nenhum prato é atribuído ao mercado de Cours Saleya apenas porque um vídeo visita os dois. |
| Edimburgo | [VisitScotland](https://www.visitscotland.com/things-to-do/food-drink/must-try-food), [Forever Edinburgh](https://edinburgh.org/blog/things-to-do-on-burns-night-in-edinburgh/) | Pratos escoceses também servidos em Edimburgo. Cullen skink é contextualizado como originário de Cullen. A fonte municipal confirma os três pratos em menus da cidade; não se presume sua venda nos mercados cadastrados. |
| Frankfurt | [Especialidades do turismo oficial](https://www.visitfrankfurt.travel/en/experience/cuisine/frankfurt-specialities) | Handkäs é uma tradição hessiana; as salsichas são apresentadas como especialidade da cidade e região. Nenhum vínculo prato → mercado é inferido. A descrição de um vídeo menciona hand käse, mas não confirma a preparação mit Musik. |
| Ljubljana | [Cozinha eslovena](https://www.visitljubljana.com/en/visitors/food-and-drink/slovenian-cuisine), [comida de rua](https://www.visitljubljana.com/en/visitors/food-and-drink/street-food-in-ljubljana), [Taste Ljubljana](https://www.visitljubljana.com/en/visitors/food-and-drink/taste-ljubljana) | Especialidades eslovenas também presentes na capital. O turismo oficial confirma kranjska klobasa na Klobasarna e štruklji no Central Market; esses são os únicos vínculos locais cadastrados. |
| Zurique | [Geschnetzeltes e rösti](https://www.zuerich.com/en/zurcher-geschnetzeltes), [Luxemburgerli](https://spruengli.ch/en/spruengli-world/luxemburgerli.html), [Sprüngli Paradeplatz](https://www.zuerich.com/en/visit/shopping/sprungli-boutique-at-paradeplatz) | Rösti é uma especialidade suíça também servida em Zurique. A página oficial da unidade confirma Luxemburgerli em Paradeplatz. A tipologia disponível `restaurant` representa a confeitaria com café no andar superior. |
| Tessalônica | [Produtos característicos — portal municipal de gastronomia](https://cityofgastronomy.thessaloniki.gr/en/proionta-thessalonikis/) | A fonte confirma os três produtos. Trigona é contextualizado no subúrbio de Panorama. Não se atribui nenhum dos pratos aos dois mercados sem fonte específica. |

## Coordenadas verificadas

Pontos obtidos em consultas pontuais ao Nominatim/OSM e à propriedade `coordinates` do MediaWiki, em 2026-10-09. Os IDs OSM abaixo identificam o objeto consultado e também constam no JSON. Centroides de polígonos e trechos de ruas representam o local; não há promessa de indicar a entrada ou uma banca individual.

| Local | Latitude, longitude | Evidência geográfica | Fonte de existência/contexto |
| --- | --- | --- | --- |
| Cours Saleya Market | 43.6956096, 7.2751036 | [OSM way/25449022](https://www.openstreetmap.org/way/25449022) | [Mercado no turismo oficial](https://www.explorenicecotedazur.com/en/event/marche-aux-fruits-legumes-et-maree-du-cours-saleya/) |
| Chez Pipo | 43.6999467, 7.2855034 | [OSM node/539387779](https://www.openstreetmap.org/node/539387779) | [Restaurante — 13 rue Bavastro](https://www.chezpipo.fr/fr) |
| Edinburgh Farmers’ Market | 55.9477605, -3.2034828 | [OSM node/574304142](https://www.openstreetmap.org/node/574304142) | [Mercados de Edimburgo](https://edinburgh.org/things-to-do/markets/) |
| Stockbridge Market | 55.9576289, -3.2084430 | [OSM node/2338447599](https://www.openstreetmap.org/node/2338447599) | [Mercados de Edimburgo](https://edinburgh.org/things-to-do/markets/) |
| Kleinmarkthalle | 50.1127197, 8.6830441 | [OSM way/449377753](https://www.openstreetmap.org/way/449377753) | [Turismo oficial](https://www.visitfrankfurt.travel/en/experience/cuisine) |
| Erzeugermarkt Konstablerwache | 50.1144122, 8.6868941 | [OSM way/391367266](https://www.openstreetmap.org/way/391367266) | [Turismo oficial](https://www.visitfrankfurt.travel/en/event/producer-market-konstablerwache) |
| Ljubljana Central Market | 46.05166667, 14.50972222 | [MediaWiki/Wikipedia](https://en.wikipedia.org/wiki/Ljubljana_Central_Market) | [Turismo oficial](https://www.visitljubljana.com/en/visitors/food-and-drink/street-food-in-ljubljana) |
| Klobasarna | 46.0504117, 14.5078841 | [OSM node/3076553064](https://www.openstreetmap.org/node/3076553064) | [Turismo oficial](https://www.visitljubljana.com/en/visitors/food-and-drink/street-food-in-ljubljana) |
| Markthalle im Viadukt | 47.3877440, 8.5263897 | [OSM way/39607099](https://www.openstreetmap.org/way/39607099) | [Turismo oficial](https://www.zuerich.com/de/besuchen/shopping/markthalle-im-viadukt) |
| Confiserie Sprüngli Paradeplatz | 47.3694816, 8.5391402 | [OSM node/648907100](https://www.openstreetmap.org/node/648907100) | [Turismo oficial](https://www.zuerich.com/en/visit/shopping/sprungli-boutique-at-paradeplatz) |
| Kapani Market | 40.6359292, 22.9426345 | [OSM way/110163670](https://www.openstreetmap.org/way/110163670) | [Turismo de Tessalônica](https://thessaloniki.travel/it/esplorare-la-citta/distretti-interessanti/modiano-kapani-louloudadika/) |
| Modiano Market | 40.6349721, 22.9418780 | [OSM relation/17416084](https://www.openstreetmap.org/relation/17416084) | [Turismo de Tessalônica](https://thessaloniki.travel/it/esplorare-la-citta/distretti-interessanti/modiano-kapani-louloudadika/) |

Cours Saleya usa um trecho pedonal do próprio corredor do mercado, confirmado pela fonte de turismo; o resultado referente à parada de ônibus foi descartado. Chez Pipo usa a unidade da Rue Bavastro; a unidade do aeroporto foi descartada. Konstablerwache usa o objeto do mercado, não as estações devolvidas pela primeira consulta. As buscas por “Tržnica Ljubljana” devolveram uma parada no bairro BTC, descartada; o Central Market utiliza a coordenada MediaWiki do local correto. Sprüngli usa a confeitaria de Bahnhofstrasse 21, junto a Paradeplatz. Kapani usa o objeto marketplace, não a relação protected_area de mesmo nome.

Dados OSM: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Consultas sequenciais com identificação do projeto, intervalo superior a um segundo e cache. Não há novas consultas geográficas em runtime.

## Vídeos e evidência dos vínculos

Os **12 vídeos** retornaram oEmbed com iframe válido e resposta oficial do player com `playabilityStatus.status = OK` e `playableInEmbed = true` em 2026-10-09. Essa consulta confirma a disponibilidade naquele momento, sem garantir disponibilidade futura. Não foram baixados vídeos ou transcrições.

Os vínculos abaixo são sustentados por título, descrição, capítulos e locais publicados pelo próprio canal. Vínculos vídeo → prato e vídeo → local são independentes: não se deduz que um prato foi consumido no local cadastrado.

| Cidade | Vídeo / publicador | Vínculos cadastrados e evidência |
| --- | --- | --- |
| Nice | [9tN53C-q4BA](https://www.youtube.com/watch?v=9tN53C-q4BA) — Destination Eat Drink | A descrição identifica socca e visita ao Cours Saleya. Não atribui a socca ao mercado. |
| Nice | [BmCd-jHq4AM](https://www.youtube.com/watch?v=BmCd-jHq4AM) — Riviera Go! | Capítulos nomeiam pissaladière, pan bagnat e socca. A lista de locais mencionados inclui Cours Saleya e Chez Pipo. O [link de Chez Pipo fornecido pelo canal](https://goo.gl/maps/wpxqBDkn7jcCF4Ps5) foi resolvido e aponta para a unidade da Rue Bavastro, consistente com o pin OSM. |
| Edimburgo | [lFjQXzLBhXM](https://www.youtube.com/watch?v=lFjQXzLBhXM) — Dan Fandelli | A descrição e o capítulo 00:54 nomeiam haggis, neeps and tatties em Edimburgo. Sem vínculo com os mercados. |
| Edimburgo | [RguWYaxlwp0](https://www.youtube.com/watch?v=RguWYaxlwp0) — STUFR – Travel & Food | Título e descrição identificam haggis consumido em Edimburgo; vínculo com o prato, sem afirmar seus acompanhamentos nesse vídeo. Sem vínculo com os mercados. |
| Frankfurt | [MEZijttOfP8](https://www.youtube.com/watch?v=MEZijttOfP8) — madventure | A descrição cita green sauce com schnitzel no Atschel e uma visita à Kleinmarkthalle; os capítulos 16:33 e 18:19 confirmam mercado e hand käse. Não se infere molho no mercado, nem Handkäs mit Musik a partir de queijo sem preparação identificada. |
| Frankfurt | [7HstJqjGzFg](https://www.youtube.com/watch?v=7HstJqjGzFg) — Mark Wiens Abroad | A descrição nomeia Frankfurter sausages consumidas no Atschel. Sem vínculo com os mercados. |
| Ljubljana | [2yPcX_ifALc](https://www.youtube.com/watch?v=2yPcX_ifALc) — Chad and Claire | A descrição identifica Kranjska klobasa em 01:54, Štruklji em 04:51 e Potica em 07:28. Os três pratos são vinculados ao vídeo; nenhum local cadastrado é identificado na descrição. |
| Ljubljana | [DW7SNhmWX9U](https://www.youtube.com/watch?v=DW7SNhmWX9U) — Marshall and Sabrina | A descrição identifica Open Kitchen e štruklji; capítulo 06:37 nomeia o prato. O turismo oficial confirma Open Kitchen no Central Market, sustentando o vínculo ao complexo do mercado. |
| Zurique | [BsytuJMjZpU](https://www.youtube.com/watch?v=BsytuJMjZpU) — Visit Zurich | O capítulo 00:35 nomeia Markthalle im Viadukt. Nenhum dos pratos cadastrados é nomeado na descrição; vínculo somente com o local. |
| Zurique | [TpZRzbHCmYo](https://www.youtube.com/watch?v=TpZRzbHCmYo) — Golgappa Girl | O capítulo 08:33 nomeia rösti no Zeughauskeller. A descrição identifica Confiserie Sprüngli em Bahnhofstrasse 21. O doce consumido ali é uma raspberry pastry, sem inferir Luxemburgerli. |
| Tessalônica | [YWjSjWnBmNA](https://www.youtube.com/watch?v=YWjSjWnBmNA) — Alex Mark Travel | Descrição e capítulo 05:33 nomeiam bougatsa no Open Lab. Sem vínculo com Kapani ou Modiano. |
| Tessalônica | [QpA8B5G1iIc](https://www.youtube.com/watch?v=QpA8B5G1iIc) — Let’s Walk The City With Me! | Descrição e capítulos identificam lojas de bougatsa e Trigona Elenidis. A menção genérica a mercados não demonstra visita específica: sem vínculo com Kapani ou Modiano. |

O candidato `xhSq3au9Bmk` foi excluído: oEmbed retornou HTTP 401, sem confirmação de incorporação pública. Foi substituído por `7HstJqjGzFg`, que passou nas duas verificações.

Locais e vídeos sem vínculo com um prato continuam acessíveis nas listas gerais da seção, graças ao comportamento já preparado no lote anterior. Este lote altera apenas dados e documentação.

## Validação local

Verificação com Node.js 22 em 2026-10-09:

- `npm run street:test`: schema, referências, repositório, loader, UI e catálogo válidos.
- `npm run map:test`: pins verificados, popups escapados, foco e limpeza aprovados.
- `node scripts/build-static.js`: 67 guias gastronômicos e 333 URLs no sitemap.
- `npm run build:validate`: 34 arquivos obrigatórios presentes, imports e conjunto exato de URLs verificados.
- `node scripts/seo-check.js`: páginas e sitemap aprovados.
- `git diff --check`: sem erros de whitespace.
- Comparação estrutural com o snapshot inicial: as 61 entradas anteriores permanecem idênticas; cada nova cidade tem três pratos, dois locais e dois vídeos. As seis páginas `/food` geradas contêm os nomes dos pratos e suas URLs canônicas.
