# STREET — Expansão europeia

Curadoria em **2026-10-08**, priorizando Europa conforme a preferência do usuário. Acrescenta **8 cidades, 24 pratos, 16 locais e 16 vídeos** ao lote brasileiro/latino-americano já preparado.

A entrega combinada amplia a `main` de **41 para 61 cidades**, com 60 pratos, 40 locais e 40 vídeos novos. Preserva integralmente as 41 entradas anteriores. O [registro do lote latino-americano](street-food-lote-2-2026-10-08.md) contém a evidência das outras 12 cidades.

Descrições redigidas para o catálogo, sem preços, horários ou alegações alimentares inferidas. Mantém o schema 1 e os slugs existentes em `data/catalog.json`.

## Cidades e especialidades

| Cidade | Pratos | Locais |
| --- | --- | --- |
| `munich` | Weißwurst, Obatzda, Leberkässemmel | Viktualienmarkt, Elisabethmarkt |
| `hamburg` | Fischbrötchen, Labskaus, Franzbrötchen | Altonaer Fischmarkt, Rindermarkthalle St. Pauli |
| `lyon` | Quenelle lyonnaise, Saucisson brioché, Tarte à la praline | Halles de Lyon Paul Bocuse, Marché Saint-Antoine Célestins |
| `milan` | Risotto alla milanese, Cotoletta alla milanese, Panettone | Mercato Comunale Wagner, Mercato Centrale Milano |
| `valencia` | Paella valenciana, Horchata de chufa, Fartons | Mercado Central de Valencia, Mercado de Colón |
| `seville` | Espinacas con garbanzos, Serranito, Torrijas | Mercado de Triana, Mercado Lonja del Barranco |
| `funchal` | Bolo do caco, Espada com banana, Lapas grelhadas | Mercado dos Lavradores, Mercado da Penteada |
| `dublin` | Boxty, Dublin coddle, Spice bag | George’s Street Arcade, Moore Street Market |

## Coordenadas verificadas

Pontos obtidos da propriedade `coordinates` do MediaWiki ou de respostas identificadas do Nominatim/OSM. O centro de um polígono representa o local, sem afirmar que é sua entrada. O Mercado de Moore Street usa o segmento pedonal OSM da rua onde funciona a feira, confirmado pelo portal municipal Dublin.ie; não representa uma banca individual.

Para George’s Street Arcade foi selecionado um trecho de passagem pedonal identificado com o nome da galeria (`way/27805936`, `type: footway`), usado como ponto representativo do local. Em Triana foi selecionado o mercado (`way/696646033`), descartando o estacionamento. Em Penteada foi selecionado o mercado, descartando o banco. Uma busca de Boxty House devolveu Jack Smyth Brewing Company em Tallaght: esse resultado não foi usado.

| Local | Latitude, longitude | Fonte geográfica | Existência/contexto |
| --- | --- | --- | --- |
| Viktualienmarkt | 48.13527778, 11.57611111 | [Coordenadas](https://en.wikipedia.org/wiki/Viktualienmarkt) | [Fonte](https://www.munich.travel/en/pois/urban-districts/viktualienmarkt) |
| Elisabethmarkt | 48.15694444, 11.57444444 | [Coordenadas](https://en.wikipedia.org/wiki/Elisabethmarkt) | [Fonte](https://en.wikipedia.org/wiki/Elisabethmarkt) |
| Altonaer Fischmarkt | 53.54561, 9.95427 | [Coordenadas](https://de.wikipedia.org/wiki/Altonaer_Fischmarkt) | [Fonte](https://de.wikipedia.org/wiki/Altonaer_Fischmarkt) |
| Rindermarkthalle St. Pauli | 53.55666667, 9.96611111 | [Coordenadas](https://de.wikipedia.org/wiki/Rindermarkthalle_St._Pauli) | [Fonte](https://de.wikipedia.org/wiki/Rindermarkthalle_St._Pauli) |
| Halles de Lyon Paul Bocuse | 45.763242, 4.850486 | [Coordenadas](https://fr.wikipedia.org/wiki/Halles_de_Lyon-Paul_Bocuse) | [Fonte](https://fr.wikipedia.org/wiki/Halles_de_Lyon-Paul_Bocuse) |
| Marché Saint-Antoine Célestins | 45.7615248, 4.831339 | [Coordenadas](https://www.openstreetmap.org/node/2911180061) | [Fonte](https://www.visiterlyon.com/sortir/boutiques-et-shopping/marches-alimentaires/marche-alimentaire-saint-antoine-celestins) |
| Mercato Comunale Wagner | 45.4682784, 9.1557439 | [Coordenadas](https://www.openstreetmap.org/way/169834097) | [Fonte](https://store.mercatidiquartiere.it/it_IT/mercato/mercato-wagner) |
| Mercato Centrale Milano | 45.4872904, 9.204061 | [Coordenadas](https://www.openstreetmap.org/node/9054003062) | [Fonte](https://www.mercatocentrale.it/milano/) |
| Mercado Central de Valencia | 39.473503, -0.378942 | [Coordenadas](https://es.wikipedia.org/wiki/Mercado_Central_de_Valencia) | [Fonte](https://es.wikipedia.org/wiki/Mercado_Central_de_Valencia) |
| Mercado de Colón | 39.46888889, -0.36833333 | [Coordenadas](https://en.wikipedia.org/wiki/Mercado_de_Col%C3%B3n) | [Fonte](https://www.visitvalencia.com/en/what-to-do-valencia/gastronomy/where-to-drink/horchata) |
| Mercado de Triana | 37.3857499, -6.0035503 | [Coordenadas](https://www.openstreetmap.org/way/696646033) | [Fonte](https://visitasevilla.es/en/traditional-markets/) |
| Mercado Lonja del Barranco | 37.3876492, -6.0021317 | [Coordenadas](https://www.openstreetmap.org/way/120418445) | [Fonte](https://www.legacy.visitasevilla.es/mercados-tradicionales/mercado-gourmet-lonja-del-barranco) |
| Mercado dos Lavradores | 32.64863889, -16.90388889 | [Coordenadas](https://en.wikipedia.org/wiki/Mercado_dos_Lavradores) | [Fonte](https://en.wikipedia.org/wiki/Mercado_dos_Lavradores) |
| Mercado da Penteada | 32.663314, -16.9286933 | [Coordenadas](https://www.openstreetmap.org/way/165351446) | [Fonte](https://cmfdoc.funchal.pt/media/k2/attachments/Programa_proced_Mercado_Penteada.pdf) |
| George’s Street Arcade | 53.3426039, -6.2643955 | [Coordenadas](https://www.openstreetmap.org/way/27805936) | [Fonte](https://georgesstreetarcade.ie/) |
| Moore Street Market | 53.3502396, -6.2625549 | [Coordenadas](https://www.openstreetmap.org/way/25902366) | [Fonte](https://dublin.ie/live/things-to-do/markets/) |

Dados OSM: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Consultas pontuais de Nominatim com identificação do projeto, mais de um segundo de intervalo e cache; não há novas chamadas em runtime.

## Fontes gastronômicas e relações com locais

URLs e datas de consulta de cada prato estão no JSON. Fontes principais:

| Cidade | Fontes | Vínculos local → prato |
| --- | --- | --- | --- |
| `munich` | [Munique: cozinha bávara](https://www.munich.travel/en/topics/eat-drink/bavarian-food), [Viktualienmarkt](https://www.munich.travel/en/pois/urban-districts/viktualienmarkt), [comida para levar](https://www.munich.travel/en/topics/urban-districts/local-love-munich/altstadt-s-fast-eats) | Obatzda e Leberkässemmel no Viktualienmarkt aparecem nas fontes oficiais. As variedades de carne do sanduíche variam; o catálogo não fixa uma receita universal. |
| `hamburg` | [Fischbrötchen](https://www.hamburg.com/visitors/dine-and-drink/fischbroetchen-1022232), [Labskaus](https://www.hamburg.com/visitors/dine-and-drink/labskaus-1022236), [Franzbrötchen](https://www.hamburg.com/visitors/dine-and-drink/hamburg-s-sweet-obsession-the-franzbroetchen-1019148) | Nenhum vínculo com os dois mercados foi inferido. Labskaus é uma tradição do norte alemão, sem atribuir sua invenção a Hamburgo. |
| `lyon` | [Especialidades de Lyon](https://en.visiterlyon.com/taste-the-finest/bons-plans/lyon-s-specialities), [Giraudet nas Halles](https://www.halles-de-lyon-paulbocuse.com/nos-commercants/giraudet/) | A página do próprio mercado confirma quenelles na Giraudet das Halles. A fonte do turismo indica tarte à la praline na Sève das Halles, mas sua referência à Giraudet é à unidade de Bellecour e não foi usada para comprovar o vínculo da quenelle. Não se inferem os três pratos em Saint-Antoine. |
| `milan` | [YesMilano](https://www.yesmilano.it/en/food), [risotto](https://it.wikipedia.org/wiki/Risotto_alla_milanese), [cotoletta](https://it.wikipedia.org/wiki/Cotoletta_alla_milanese), [panettone](https://it.wikipedia.org/wiki/Panettone) | Mercados sem vínculo específico com pratos. Panettone é descrito como especialidade tradicional da época de Natal, sem prometer disponibilidade constante. |
| `valencia` | [Receitas oficiais](https://blog.visitvalencia.com/en/paella-horchata-or-esgarraet-valencian-recipes-prepare-at-home), [horchata e fartons](https://www.visitvalencia.com/en/what-to-do-valencia/gastronomy/where-to-drink/horchata) | A fonte oficial indica Horchatería Daniel no Mercado de Colón, sustentando horchata. Não se deduz paella em qualquer mercado. |
| `seville` | [Guia gastronômico oficial](https://visitasevilla.es/wp-content/uploads/2023/06/SEVILLA_GASTRONOMICA_compressed.pdf), [guia municipal](https://tic.visitasevilla.es/vsev/Web_php/imatges/guias/1425165a51fa093898966467942.pdf), [serranito](https://en.wikipedia.org/wiki/Serranito) | Não se inferem esses pratos em Triana ou Barranco. Torrijas são contextualizadas na Quaresma e Semana Santa. |
| `funchal` | [Bolo do caco](https://visitmadeira.com/en/what-to-do/food-and-wine-enthusiasts/traditional-madeira-food/bolo-do-caco/), [peixe-espada](https://visitmadeira.com/en/what-to-do/food-and-wine-enthusiasts/traditional-madeira-food/filete-de-espada/), [lapas](https://visitmadeira.com/en/what-to-do/food-and-wine-enthusiasts/traditional-madeira-food/grilled-limpets/) | Especialidades da Madeira disponíveis na cultura alimentar de Funchal, sem reivindicar origem na cidade nem venda específica nos mercados. |
| `dublin` | [Visit Dublin](https://www.visitdublin.com/guides/irish-food), [boxty](https://en.wikipedia.org/wiki/Boxty), [cardápio do Boxty House](https://www.boxtyhouse.ie/_files/ugd/a670ee_f25aa4cf804c4c28a8fdae60ea8ab080.pdf), [spice bag](https://en.wikipedia.org/wiki/Spice_bag) | Boxty tem raízes em outras regiões irlandesas; é apresentado como prato também servido em Dublin. Nenhuma relação com os dois mercados foi inferida. |

## Vídeos e vínculos

Os 16 vídeos retornaram oEmbed HTTP 200 e iframe válido, além de `playabilityStatus.status = OK` e `playableInEmbed = true` na página oficial do YouTube. A checagem ocorreu em 2026-10-08 e não garante disponibilidade futura. Relações `dishIds` e `placeIds` são independentes; um prato visto em um restaurante não é automaticamente atribuído a um mercado.

| Cidade | Vídeo / publicador | Evidência |
| --- | --- | --- |
| `munich` | [XUBT8h2ympg](https://www.youtube.com/watch?v=XUBT8h2ympg) — Bernd Zehner | Título e descrição identificam Viktualienmarkt e nomeiam Weißwurst entre os alimentos experimentados. |
| `munich` | [jl-B7lFqL8c](https://www.youtube.com/watch?v=jl-B7lFqL8c) — Abroad and Hungry | Descrição identifica a viagem gastronômica em Munique e lista Viktualienmarkt entre os locais visitados; não nomeia os três pratos cadastrados. |
| `hamburg` | [sGRw--AduNI](https://www.youtube.com/watch?v=sGRw--AduNI) — DW Euromaxx | Publicador DW Euromaxx identifica o mercado de peixe de Hamburgo no título, descrição e capítulos; não nomeia os pratos selecionados. |
| `hamburg` | [FGimLkw45j0](https://www.youtube.com/watch?v=FGimLkw45j0) — Food Flash | Título e descrição nomeiam Fischbrötchen; os vendedores listados não são os dois mercados cadastrados. |
| `lyon` | [5yWufPQVmy8](https://www.youtube.com/watch?v=5yWufPQVmy8) — Lyon FOOD Tour | Título e descrição identificam as Halles Paul Bocuse e uma visita às suas casas gastronômicas, sem nomear os pratos cadastrados. |
| `lyon` | [yShrWL54wIU](https://www.youtube.com/watch?v=yShrWL54wIU) — Laura Bronner | Título e descrição identificam um tour gastronômico na cidade, sem vínculo específico comprovado com os pratos ou locais cadastrados. |
| `milan` | [Dlh1aR_hWQM](https://www.youtube.com/watch?v=Dlh1aR_hWQM) — The Bautista-Bakers Travel Vlogs | Título e descrição identificam um tour gastronômico na cidade, sem vínculo específico comprovado com os pratos ou locais cadastrados. |
| `milan` | [7Oz7aTAeqgk](https://www.youtube.com/watch?v=7Oz7aTAeqgk) — Condé Nast Traveler | Título e descrição identificam um tour gastronômico na cidade, sem vínculo específico comprovado com os pratos ou locais cadastrados. |
| `valencia` | [gSFLNjUjoB4](https://www.youtube.com/watch?v=gSFLNjUjoB4) — Spain Revealed | Título identifica Valência e paella, mas não confirma a variante valenciana nem o nome dos mercados; mantém-se como vídeo geral. |
| `valencia` | [7ZaZsjWVz4k](https://www.youtube.com/watch?v=7ZaZsjWVz4k) — TOPJAW | Descrição identifica explicitamente a paella valenciana tradicional. O capítulo Orxateria Daniel não identifica qual unidade foi visitada, então não há vínculo com Colón. |
| `seville` | [yK9xHogNzHc](https://www.youtube.com/watch?v=yK9xHogNzHc) — MY Travel BF | Descrição apresenta um tour de tapas pelo bairro de Triana; o bairro não equivale a uma visita comprovada ao mercado. |
| `seville` | [8Tl39wMfq8o](https://www.youtube.com/watch?v=8Tl39wMfq8o) — Expat Andrew | Título, descrição e capítulos identificam o Mercado de Triana. Paella e arepa aparecem, mas não são os três pratos selecionados para Sevilha. |
| `funchal` | [q7t5Fh3nJuA](https://www.youtube.com/watch?v=q7t5Fh3nJuA) — JoeyP | Título e descrição identificam um tour gastronômico na cidade, sem vínculo específico comprovado com os pratos ou locais cadastrados. |
| `funchal` | [Aw0aGo84Im4](https://www.youtube.com/watch?v=Aw0aGo84Im4) — ED KUZMIN | THE BEETLE | Título e descrição identificam Funchal; o capítulo 13:10 nomeia Mercado dos Lavradores. Capítulos genéricos de frutos do mar não comprovam os pratos específicos. |
| `dublin` | [EYLvcQSdV1w](https://www.youtube.com/watch?v=EYLvcQSdV1w) — Adam and Madalyn | Título identifica boxty e o capítulo 05:30 nomeia Gallagher’s Boxty House em Dublin. A lista genérica de pratos na descrição não comprova coddle consumido neste vídeo. |
| `dublin` | [NrgHTGQ9TUQ](https://www.youtube.com/watch?v=NrgHTGQ9TUQ) — Eating With Cam | Descrição lista explicitamente Dublin Coddle no John Kavanagh The Gravediggers, que não é um dos mercados cadastrados. |

Vídeos e locais sem vínculo com um prato publicado aparecem nas listas gerais do guia graças à correção de renderização incluída nesta entrega. Registros associados a pratos não são repetidos nessas listas. Filtros editoriais, coordenadas verificadas e reprodução após o clique continuam aplicados.
