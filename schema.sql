-- Tabela de Categorias
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  preco DECIMAL(10, 2) NOT NULL,
  preco_antigo DECIMAL(10, 2),
  categoria_id UUID REFERENCES categorias(id),
  genero VARCHAR(20) CHECK (genero IN ('masculino', 'feminino', 'unissex')),
  cor VARCHAR(50),
  imagem_principal TEXT NOT NULL,
  imagens_adicionais TEXT[],
  destaque BOOLEAN DEFAULT false,
  tendencia BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  avaliacao DECIMAL(2, 1) DEFAULT 0,
  num_avaliacoes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Estoque (tamanhos)
CREATE TABLE estoque (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  tamanho VARCHAR(10) NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(produto_id, tamanho)
);

-- Tabela de Cupons
CREATE TABLE cupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('percentual', 'fixo')),
  valor DECIMAL(10, 2) NOT NULL,
  valor_minimo DECIMAL(10, 2) DEFAULT 0,
  validade DATE NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Pedidos
CREATE TABLE pedidos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_nome VARCHAR(255) NOT NULL,
  cliente_email VARCHAR(255) NOT NULL,
  cliente_telefone VARCHAR(20),
  endereco_rua VARCHAR(255) NOT NULL,
  endereco_numero VARCHAR(20) NOT NULL,
  endereco_complemento VARCHAR(100),
  endereco_bairro VARCHAR(100) NOT NULL,
  endereco_cidade VARCHAR(100) NOT NULL,
  endereco_estado VARCHAR(2) NOT NULL,
  endereco_cep VARCHAR(9) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  desconto DECIMAL(10, 2) DEFAULT 0,
  frete DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  cupom_codigo VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'enviado', 'entregue', 'cancelado')),
  tipo_envio VARCHAR(20) DEFAULT 'nacional' CHECK (tipo_envio IN ('nacional', 'internacional')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Itens do Pedido
CREATE TABLE itens_pedido (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  nome_produto VARCHAR(255) NOT NULL,
  tamanho VARCHAR(10) NOT NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_genero ON produtos(genero);
CREATE INDEX idx_produtos_destaque ON produtos(destaque);
CREATE INDEX idx_produtos_tendencia ON produtos(tendencia);
CREATE INDEX idx_estoque_produto ON estoque(produto_id);
CREATE INDEX idx_pedidos_status ON pedidos(status);
CREATE INDEX idx_pedidos_created ON pedidos(created_at);
CREATE INDEX idx_itens_pedido ON itens_pedido(pedido_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Dados iniciais de exemplo
INSERT INTO categorias (nome, slug, descricao) VALUES
  ('Vestidos', 'vestidos', 'Vestidos para todas as ocasiões'),
  ('Macacões', 'macacoes', 'Macacões modernos e estilosos'),
  ('Blusas', 'blusas', 'Blusas femininas e masculinas'),
  ('Calças', 'calcas', 'Calças de diversos estilos');

INSERT INTO cupons (codigo, tipo, valor, valor_minimo, validade) VALUES
  ('BEM25', 'percentual', 25, 169.00, '2025-12-31'),
  ('DESC15', 'fixo', 15.00, 50.00, '2025-12-31');