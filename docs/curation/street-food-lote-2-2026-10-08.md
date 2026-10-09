# STREET — Curadoria do lote 2

Verificação editorial em **2026-10-08**, a partir da `main` após o PR #10. O catálogo passa de 41 para **53 cidades**: 12 novas cidades, 36 pratos, 24 locais e 24 vídeos. As 41 entradas anteriores são preservadas.

Este documento registra a etapa brasileira/latino-americana. A [etapa europeia adicional](street-food-europe-2026-10-08.md), incluída após a preferência do usuário, leva a entrega combinada a 61 cidades.

Este lote prioriza seis cidades brasileiras e seis cidades de outros países da América Latina. Mantém o schema 1, os slugs do catálogo urbano, três pratos e dois locais/vídeos por cidade. As descrições são redação editorial própria; fontes de cada prato e datas de consulta estão em `data/street-food.json`.

## Cobertura adicionada

| Cidade | Pratos | Locais | Vídeos |
| --- | --- | --- | --- |
| `salvador` | Acarajé, Moqueca baiana, Vatapá | Feira de São Joaquim, Mercado do Rio Vermelho | 2 |
| `recife` | Bolo de rolo, Tapioca, Cartola | Mercado de São José, Mercado da Boa Vista | 2 |
| `belem` | Tacacá, Maniçoba, Açaí com peixe | Mercado Ver-o-Peso, Mercado de São Brás | 2 |
| `belo-horizonte` | Pão de queijo, Feijão tropeiro, Fígado com jiló | Mercado Central de Belo Horizonte, Mercado Novo | 2 |
| `curitiba` | Carne de onça, Pierogi, Pastel de feira | Mercado Municipal de Curitiba, Feira do Largo da Ordem | 2 |
| `fortaleza` | Baião de dois, Panelada, Camarão do Mucuripe | Mercado dos Peixes do Mucuripe, Mercado São Sebastião | 2 |
| `lima` | Ceviche, Anticuchos, Picarones | Mercado Central de Lima, Mercado de Surquillo N.º 1 | 2 |
| `cusco` | Chiri uchu, Trucha frita, Choclo con queso | Mercado Central de San Pedro, Mercado de San Blas | 2 |
| `medellin` | Bandeja paisa, Arepa de chócolo, Empanada paisa | Plaza Minorista José María Villa, Placita de Flórez | 2 |
| `cartagena` | Arepa de huevo, Arroz con coco, Cocadas | Mercado de Bazurto, Portal de los Dulces | 2 |
| `quito` | Locro de papa, Hornado, Fritada | Mercado Central de Quito, Mercado Santa Clara | 2 |
| `montevideo` | Chivito, Choripán, Asado | Mercado del Puerto, Mercado Agrícola de Montevideo | 2 |

## Evidência dos pins

As coordenadas abaixo foram extraídas das respostas de Wikidata (`P625`), MediaWiki (`coordinates`) ou Nominatim/OSM, consultadas durante a curadoria. Centros de polígonos são pontos representativos do mercado, sem promessa de representar uma entrada. IDs OSM correspondem ao objeto efetivamente consultado e ficam no JSON quando disponíveis.

O Mercado do Rio Vermelho usa o polígono OSM do próprio mercado na Avenida Juracy Magalhães Júnior. A coordenada da página da Wikipedia foi descartada por apontar para o centro de Salvador; a coordenada de Wikidata também divergia do polígono. O Portal de los Dulces usa um ponto representativo do corredor de vendedores, e não de uma banca individual. A Plaza Minorista usa o ponto da praça de circulação identificada com o nome do mercado no OSM.

| Local | Latitude, longitude | Fonte geográfica | Existência/contexto |
| --- | --- | --- | --- |
| Feira de São Joaquim | -12.951, -38.50161111111111 | [Coordenadas](https://www.wikidata.org/wiki/Q10280873) | [Fonte](https://pt.wikipedia.org/wiki/Feira_de_S%C3%A3o_Joaquim) |
| Mercado do Rio Vermelho | -13.0017083, -38.4818353 | [Coordenadas](https://www.openstreetmap.org/way/310356391) | [Fonte](https://www.openstreetmap.org/way/310356391) |
| Mercado de São José | -8.06852, -34.87768 | [Coordenadas](https://www.wikidata.org/wiki/Q6818002) | [Fonte](https://pt.wikipedia.org/wiki/Mercado_de_S%C3%A3o_Jos%C3%A9) |
| Mercado da Boa Vista | -8.0632928, -34.8886107 | [Coordenadas](https://www.openstreetmap.org/relation/11377204) | [Fonte](https://www.openstreetmap.org/relation/11377204) |
| Mercado Ver-o-Peso | -1.45222, -48.50361 | [Coordenadas](https://pt.wikipedia.org/wiki/Mercado_Ver-o-Peso) | [Fonte](https://pt.wikipedia.org/wiki/Mercado_Ver-o-Peso) |
| Mercado de São Brás | -1.4514311, -48.4685174 | [Coordenadas](https://www.wikidata.org/wiki/Q10328801) | [Fonte](https://pt.wikipedia.org/wiki/Mercado_de_S%C3%A3o_Br%C3%A1s) |
| Mercado Central de Belo Horizonte | -19.9225, -43.943055555556 | [Coordenadas](https://www.wikidata.org/wiki/Q10328758) | [Fonte](https://mercadocentral.com.br/o-mercado/) |
| Mercado Novo | -19.92064, -43.94529 | [Coordenadas](https://pt.wikipedia.org/wiki/Mercado_Novo_(Belo_Horizonte)) | [Fonte](https://portalbelohorizonte.com.br/o-que-fazer/comer-e-beber/mercados-gastronomicos/velho-mercado-novo) |
| Mercado Municipal de Curitiba | -25.434823754464105, -49.257044509073395 | [Coordenadas](https://www.wikidata.org/wiki/Q10328772) | [Fonte](https://pt.wikipedia.org/wiki/Mercado_Municipal_de_Curitiba) |
| Feira do Largo da Ordem | -25.4274472, -49.2738639 | [Coordenadas](https://pt.wikipedia.org/wiki/Feira_do_Largo_da_Ordem) | [Fonte](https://pt.wikipedia.org/wiki/Feira_do_Largo_da_Ordem) |
| Mercado dos Peixes do Mucuripe | -3.7215759, -38.4797459 | [Coordenadas](https://www.openstreetmap.org/way/509654793) | [Fonte](https://visit-fortaleza.com/experiencias/mercado-dos-peixes/) |
| Mercado São Sebastião | -3.7300486, -38.5391596 | [Coordenadas](https://www.openstreetmap.org/relation/16025914) | [Fonte](https://www.fortaleza.ce.gov.br/noticias/fortaleza-298-anos-mercados-publicos-sao-boas-opcoes-de-passeio) |
| Mercado Central de Lima | -12.050063, -77.025994 | [Coordenadas](https://es.wikipedia.org/wiki/Mercado_Central_de_Lima) | [Fonte](https://es.wikipedia.org/wiki/Mercado_Central_de_Lima) |
| Mercado de Surquillo N.º 1 | -12.1180304, -77.0254758 | [Coordenadas](https://www.openstreetmap.org/way/220048425) | [Fonte](https://www.peru.travel/lima2019/es/conoce-lima/imperdibles.html) |
| Mercado Central de San Pedro | -13.520997, -71.982618 | [Coordenadas](https://es.wikipedia.org/wiki/Mercado_Central_de_San_Pedro) | [Fonte](https://www.peru.travel/es/inspirate/mercado-san-pedro-el-mas-antiguo-y-pintoresco-de-cusco) |
| Mercado de San Blas | -13.5155828, -71.9728947 | [Coordenadas](https://www.openstreetmap.org/relation/9045217) | [Fonte](https://www.peru.travel/es/inspirate/cuales-son-los-mercados-mas-emblematicos-y-pintorescos-de-cusco) |
| Plaza Minorista José María Villa | 6.2576308, -75.5734559 | [Coordenadas](https://www.openstreetmap.org/way/433081101) | [Fonte](https://www.medellin.travel/sabores/) |
| Placita de Flórez | 6.245919, -75.5599993 | [Coordenadas](https://www.openstreetmap.org/way/263305157) | [Fonte](https://www.medellin.travel/placita-de-florez/) |
| Mercado de Bazurto | 10.4126304, -75.5246392 | [Coordenadas](https://www.openstreetmap.org/way/94687123) | [Fonte](https://www.openstreetmap.org/way/94687123) |
| Portal de los Dulces | 10.4229837, -75.5494977 | [Coordenadas](https://www.openstreetmap.org/way/25442420) | [Fonte](https://colombia.travel/es/blog/planes-para-disfrutar-cartagena-en-un-fin-de-semana-1) |
| Mercado Central de Quito | -0.2198886, -78.5069701 | [Coordenadas](https://www.openstreetmap.org/way/335664092) | [Fonte](https://visitquito.ec/es/ruta-de-los-mercados-quito/) |
| Mercado Santa Clara | -0.199998, -78.4993644 | [Coordenadas](https://www.openstreetmap.org/node/6512691585) | [Fonte](https://visitquito.ec/es/ruta-de-los-mercados-quito/) |
| Mercado del Puerto | -34.905673, -56.211784 | [Coordenadas](https://es.wikipedia.org/wiki/Mercado_del_Puerto) | [Fonte](https://es.wikipedia.org/wiki/Mercado_del_Puerto) |
| Mercado Agrícola de Montevideo | -34.88694444, -56.18333333 | [Coordenadas](https://es.wikipedia.org/wiki/Mercado_Agr%C3%ADcola_de_Montevideo) | [Fonte](https://es.wikipedia.org/wiki/Mercado_Agr%C3%ADcola_de_Montevideo) |

Contexto adicional: [mercados do Recife](https://www2.recife.pe.gov.br/servico/mercados-0), [mercados de Lima](https://www.peru.travel/lima2019/es/conoce-lima/imperdibles.html), [mercados de Cusco](https://www.peru.travel/es/inspirate/cuales-son-los-mercados-mas-emblematicos-y-pintorescos-de-cusco), [mercados de Medellín](https://www.medellin.travel/sabores/), [Portal de los Dulces](https://colombia.travel/es/blog/planes-para-disfrutar-cartagena-en-un-fin-de-semana-1), [Bazurto](https://www.cartagena.gov.co/noticias/nuevo-bazurto-alcaldia-cartagena-socializa-como-sera-el-nuevo-distrito-cultural-turistico-gastronomico-el-lugar-actual-central-abastos).

Dados geográficos OSM: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. Consultas pontuais de Nominatim foram feitas com identificação do projeto, intervalo superior a um segundo e cache local; não há chamadas novas em runtime. As duas tentativas iniciais de Overpass retornaram HTTP 406 e não forneceram dados usados no lote.

## Vídeos e vínculos editoriais

Os 24 vídeos abaixo retornaram oEmbed HTTP 200 com iframe de incorporação e resposta da página do YouTube com `playabilityStatus.status = OK` e `playableInEmbed = true`, em 2026-10-08. Títulos, descrições e capítulos do próprio publicador confirmaram cidade e os vínculos registrados. Isso é uma verificação pontual; disponibilidade posterior continua sujeita ao YouTube.

`dishIds` e `placeIds` são relações independentes: um vídeo pode visitar um mercado e experimentar um prato em outra parte da cidade. Um vínculo vídeo→mercado não afirma que todos os pratos do vídeo são vendidos nesse mercado. Sem evidência específica, o vetor correspondente fica vazio e o vídeo permanece como conteúdo geral da cidade.

O guia agora exibe locais e vídeos sem vínculo com um prato publicado em listas gerais. A revisão detectou que o renderer anterior ocultava 17 locais e 13 vídeos deste lote; a correção preserva as relações vazias, os filtros de publicação e coordenadas, a abertura do mapa e a reprodução apenas após o clique. Registros já apresentados nos pratos não são repetidos nas listas gerais.

| Cidade | Vídeo / publicador | Evidência usada |
| --- | --- | --- |
| `salvador` | [Nyr7kL3s91w](https://www.youtube.com/watch?v=Nyr7kL3s91w) — Mark Wiens | Description explicitly starts at São Joaquim and names moqueca, acarajé and its vatapá filling later in the tour; these dishes are not assigned to São Joaquim. |
| `salvador` | [uXrsnLjBjwc](https://www.youtube.com/watch?v=uXrsnLjBjwc) — RIO4FUN | Title and description name acarajé and moqueca; the visited vendors are not either curated market. |
| `recife` | [k2FJoi8O0Pg](https://www.youtube.com/watch?v=k2FJoi8O0Pg) — givanilson berg | Title and description establish street food at Boa Viagem in Recife; neither curated market nor these three dishes is explicitly identified. |
| `recife` | [yW47i4Z9VXE](https://www.youtube.com/watch?v=yW47i4Z9VXE) — givanilson berg | Title and description establish food at Casa Amarela in Recife, a different market from the two curated places. |
| `belem` | [8yfkENiAXFM](https://www.youtube.com/watch?v=8yfkENiAXFM) — Mark Wiens | Description identifies Ver-o-Peso at the beginning and tacacá at Tacacá da Diva later; no tacacá-to-market claim. |
| `belem` | [q9jiGKKGkT8](https://www.youtube.com/watch?v=q9jiGKKGkT8) — O Que Vi Pelo Mundo | Title names tacacá and Belém; description does not establish a curated market or the savory açaí-with-fish combination. |
| `belo-horizonte` | [T2lwQaqZ2NA](https://www.youtube.com/watch?v=T2lwQaqZ2NA) — Gaba | Description and chapters identify Mercado Central, pão de queijo at 02:40 and fígado com jiló at 37:20; start at the first linked dish. |
| `belo-horizonte` | [BQ490deUsHA](https://www.youtube.com/watch?v=BQ490deUsHA) — Rodrigo Diana | Title and description explicitly name both markets; individual dishes are not named in the description. |
| `curitiba` | [EcCY8h5c3IY](https://www.youtube.com/watch?v=EcCY8h5c3IY) — Me Leva Viajar | Title and description explicitly place the food visit at Feira do Largo da Ordem; no named dish in the description. |
| `curitiba` | [p1EwdzXJoVk](https://www.youtube.com/watch?v=p1EwdzXJoVk) — Não Tão Jovem Adulta | Title and description identify a visit including food at Feira do Largo da Ordem; no named dish association. |
| `fortaleza` | [kvu4Kec5S14](https://www.youtube.com/watch?v=kvu4Kec5S14) — Gaba | Title and description identify the fish market; chapter 06:19 explicitly names shrimp. The description labels the neighborhood Meireles; market location is independently sourced from OSM and Visit Fortaleza. |
| `fortaleza` | [zUOffHaXNlM](https://www.youtube.com/watch?v=zUOffHaXNlM) — Nois Pelo Mundo [Oficial] | Title and description explicitly identify Mercado São Sebastião; no individual dish association. |
| `lima` | [Il3NjMlQ_dk](https://www.youtube.com/watch?v=Il3NjMlQ_dk) — Mark Wiens | Description names all three dishes. The market visited is La Parada, so no link to Mercado Central or Surquillo. |
| `lima` | [USgtb0ULCd0](https://www.youtube.com/watch?v=USgtb0ULCd0) — John and Jocelyn (JJescapes) | Description and chapters name anticuchos at 06:05 and Picarones Mary at 08:59; no curated-market association. |
| `cusco` | [TXYVdKXxtP0](https://www.youtube.com/watch?v=TXYVdKXxtP0) — Strictly Dumpling | Title and description name San Pedro in Cusco; descriptions do not name the three curated dishes. |
| `cusco` | [IORgNPa573I](https://www.youtube.com/watch?v=IORgNPa573I) — Erik Out There | Title and description explicitly identify San Pedro market; no named dish association. |
| `medellin` | [3bkQroIAQm4](https://www.youtube.com/watch?v=3bkQroIAQm4) — Sammy and Tommy | Publisher chapters name empanada at 01:48 and arepa de chocolo at 03:45; no curated-market location in the description. |
| `medellin` | [8gnNP9nSmVE](https://www.youtube.com/watch?v=8gnNP9nSmVE) — Max and Jacqueline | Title and main description establish a food tour in Medellín’s Comuna 13; appended chapters refer to Cartagena and are not used as evidence. |
| `cartagena` | [cr-SITyHsNI](https://www.youtube.com/watch?v=cr-SITyHsNI) — davetravels | City-level food tour; no individual dish or place association. |
| `cartagena` | [X5Qroc5eCck](https://www.youtube.com/watch?v=X5Qroc5eCck) — Britt and Mitch Worldwide | City-level food tour; no individual dish or place association. |
| `quito` | [lWDy2GgjYtQ](https://www.youtube.com/watch?v=lWDy2GgjYtQ) — Gareth Eats | Description explicitly identifies hornado at the food stalls of Mercado Santa Clara. |
| `quito` | [un7urWfZvSM](https://www.youtube.com/watch?v=un7urWfZvSM) — Sammy and Tommy | City-level food tour; no individual dish or place association. |
| `montevideo` | [9wZe2kxDyGw](https://www.youtube.com/watch?v=9wZe2kxDyGw) — Brent Timm | Description explicitly identifies choripán at Montevideo’s Tristán Narvaja fair; that fair is not one of the two curated markets. |
| `montevideo` | [y2pky9SUB98](https://www.youtube.com/watch?v=y2pky9SUB98) — Mike Chen Clips & BEST Eats | Title and description explicitly establish Montevideo; individual dishes and curated markets are not identified in the description. |

## Decisões de curadoria

- Sem preços, horários ou alegações alimentares inferidas. `dietaryClaims` permanece vazio.
- Os vídeos de Recife retratam Boa Viagem e Casa Amarela. Eles não são associados aos mercados São José/Boa Vista, nem aos pratos do lote, porque as descrições não demonstram esses vínculos.
- Em Salvador, a moqueca e o acarajé mostrados em `Nyr7kL3s91w` são consumidos depois da visita a São Joaquim; o mercado permanece sem `dishIds`.
- Em Lima, `Il3NjMlQ_dk` visita La Parada, não os dois mercados cadastrados. Os vínculos com ceviche, anticuchos e picarones vêm da descrição do publicador.
- Em Medellín, os capítulos de `8gnNP9nSmVE` mencionam Cartagena e foram descartados. Apenas o título e a descrição principal sustentam a seleção como tour de Comuna 13, sem vínculos específicos.
- O vídeo `LGokG5mvL4o` foi considerado e descartado para este lote: descreve o Uruguai em geral e não estabelece Montevidéu como local dos pratos. Foi substituído por `y2pky9SUB98`, cujo título e descrição identificam a cidade.
- Há projeto de relocalização/revitalização de Bazurto na fonte municipal. O pin representa o mercado atual consultado, sem antecipar localização futura; sua atualização exige nova curadoria.

Os vínculos local→prato limitam-se às fontes que os demonstram: açaí com peixe no Ver-o-Peso ([relato da visita](https://viajeleve.net/mercado-ver-o-peso/)); pão de queijo e fígado com jiló no Mercado Central ([publicador](https://www.youtube.com/watch?v=T2lwQaqZ2NA)); camarão no Mucuripe ([Visit Fortaleza](https://visit-fortaleza.com/experiencias/mercado-dos-peixes/)); panelada no São Sebastião ([Prefeitura](https://www.fortaleza.ce.gov.br/noticias/fortaleza-298-anos-mercados-publicos-sao-boas-opcoes-de-passeio)); três pratos no San Pedro ([PROMPERÚ](https://www.peru.travel/es/inspirate/mercado-san-pedro-el-mas-antiguo-y-pintoresco-de-cusco)); cocadas no Portal ([Colombia Travel](https://colombia.travel/es/blog/planes-para-disfrutar-cartagena-en-un-fin-de-semana-1)); hornado no Santa Clara ([publicador](https://www.youtube.com/watch?v=lWDy2GgjYtQ)).
