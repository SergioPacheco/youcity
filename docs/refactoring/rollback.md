# Rollback da refatoração

1. Interrompa a publicação do artefato gerado, sem alterar dados do catálogo ou
   storage dos usuários.
2. Publique novamente o último artefato conhecido da branch anterior à
   refatoração, ou reverta este conjunto de alterações em uma branch de trabalho.
3. Confirme `node scripts/build-static.js`, `node scripts/seo-check.js` e `npm test`
   antes de disponibilizar o artefato anterior.
4. Se o problema estiver restrito a um módulo opcional, mantenha o runtime e
   remova apenas o gatilho do lazy loading enquanto investiga; os caminhos de
   retry não fazem reload automático da página.

Não há migração de banco ou mudança deliberada de chaves de storage nesta
refatoração. O rollback de código não exige limpeza dos dados locais.
