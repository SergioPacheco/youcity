"""
Carrega variáveis de ambiente do .env para testes locais.

Uso:
    from tools.social.load_env import load_env
    load_env()
"""
from pathlib import Path


def load_env(env_path: Path | None = None) -> None:
    """
    Carrega .env e exporta variáveis para os.environ.
    
    Args:
        env_path: Caminho para .env (default: .env na raiz do repo)
    """
    import os
    
    if env_path is None:
        # Procurar .env na raiz do repo
        env_path = Path(__file__).parent.parent.parent / ".env"
    
    if not env_path.exists():
        print(f"⚠️  .env não encontrado em {env_path}")
        return
    
    print(f"📖 Carregando {env_path}")
    
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            
            # Ignorar comentários e linhas vazias
            if not line or line.startswith("#"):
                continue
            
            # Parsear KEY=VALUE
            if "=" not in line:
                continue
            
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip()
            
            # Só definir se não existe
            if key and key not in os.environ:
                os.environ[key] = value
                # Não imprimir valores sensíveis
                if "TOKEN" in key or "SECRET" in key or "KEY" in key:
                    print(f"   ✓ {key}=***")
                else:
                    print(f"   ✓ {key}={value[:30]}{'...' if len(value) > 30 else ''}")


if __name__ == "__main__":
    load_env()
    print("\n✅ Variáveis carregadas do .env")
