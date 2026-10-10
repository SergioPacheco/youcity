#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar catalog.json
const catalogPath = path.join(__dirname, '..', 'data', 'catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const unavailableVideos = [];

// Função para verificar disponibilidade via oEmbed (sem chave API)
async function checkYouTubeVideo(videoId, mode, city) {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  
  try {
    const response = await fetch(oembedUrl, { method: 'HEAD', redirect: 'follow' });
    
    if (!response.ok) {
      unavailableVideos.push({
        city,
        mode,
        videoId,
        status: response.status,
        statusText: response.statusText,
        reason: `HTTP ${response.status}`
      });
      return false;
    }
    
    // Verificar se o oEmbed devolveu dados válidos
    const oembedResponse = await fetch(oembedUrl);
    if (!oembedResponse.ok) {
      unavailableVideos.push({
        city,
        mode,
        videoId,
        status: oembedResponse.status,
        statusText: oembedResponse.statusText,
        reason: `oEmbed HTTP ${oembedResponse.status}`
      });
      return false;
    }
    
    const data = await oembedResponse.json();
    if (!data || !data.html || data.error) {
      unavailableVideos.push({
        city,
        mode,
        videoId,
        status: 200,
        reason: 'oEmbed sem resposta válida',
        raw: data
      });
      return false;
    }
    
    return true;
  } catch (error) {
    unavailableVideos.push({
      city,
      mode,
      videoId,
      reason: error.message
    });
    return false;
  }
}

async function checkAllVideos() {
  console.log('Verificando vídeos do catálogo...\n');
  
  // Limite para não sobrecarregar (ex: 10 primeiros por modo)
  let processed = 0;
  const limit = 500; // Ajustar conforme necessário
  
  for (const cityData of catalog) {
    const city = cityData.name;
    
    for (const [mode, videos] of Object.entries(cityData.videos)) {
      if (!videos || videos.length === 0) continue;
      
      for (const video of videos) {
        if (processed >= limit) break;
        
        const isAvailable = await checkYouTubeVideo(video.id, mode, city);
        processed++;
        
        if (isAvailable) {
          console.log(`✓ ${city} (${mode}): ${video.id}`);
        } else {
          console.log(`✗ ${city} (${mode}): ${video.id}`);
        }
      }
    }
    
    if (processed >= limit) break;
  }
  
  // Resumo
  console.log('\n--- Resumo ---');
  console.log(`Total verificado: ${processed}`);
  console.log(`Indisponíveis: ${unavailableVideos.length}`);
  
  if (unavailableVideos.length > 0) {
    console.log('\nVídeos indisponíveis:');
    unavailableVideos.forEach(v => {
      console.log(`  - ${v.city} (${v.mode}): ${v.videoId} → ${v.reason}`);
    });
    
    // Salvar relatório
    const reportPath = path.join(__dirname, '..', 'reports', 'unavailable-videos.json');
    fs.writeFileSync(reportPath, JSON.stringify(unavailableVideos, null, 2));
    console.log(`\nRelatório salvo em: ${reportPath}`);
  }
}

// Executar
checkAllVideos().catch(console.error);
