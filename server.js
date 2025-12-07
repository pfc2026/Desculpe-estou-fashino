const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const multer = require('multer');
const ImageKit = require('imagekit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ImageKit
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// Multer
const upload = multer({ storage: multer.memoryStorage() });

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_mude_isso_em_producao';
const SALT_ROUNDS = 10;

// ==================== MIDDLEWARE DE AUTENTICAÇÃO ====================

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, tipo, ativo')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo' });
    }
    
    req.userId = decoded.userId;
    req.userTipo = usuario.tipo;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('id, tipo, ativo')
      .eq('id', decoded.userId)
      .single();
    
    if (error || !usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inválido' });
    }
    
    if (usuario.tipo !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    
    req.userId = decoded.userId;
    req.userTipo = usuario.tipo;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

// ==================== AUTENTICAÇÃO ====================

// Registro
app.post('/api/auth/registro', async (req, res) => {
  try {
    const { nome, email, senha, telefone } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (existente) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .insert([{
        nome,
        email,
        senha: senhaHash,
        telefone: telefone || null,
        tipo: 'cliente'
      }])
      .select('id, nome, email, tipo')
      .single();

    if (error) {
      console.error('Erro ao criar usuário:', error);
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }

    const token = jwt.sign(
      { userId: usuario.id, tipo: usuario.tipo },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
      },
      token
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro ao processar registro' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const { data: usuario, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    if (!usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inativo' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const token = jwt.sign(
      { userId: usuario.id, tipo: usuario.tipo },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
      },
      token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro ao processar login' });
  }
});

// Perfil do usuário
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, telefone, tipo')
      .eq('id', req.userId)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== UPLOAD DE IMAGENS ====================

app.post('/api/upload', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const result = await imagekit.upload({
      file: req.file.buffer,
      fileName: `${Date.now()}_${req.file.originalname}`,
      folder: '/produtos'
    });

    res.json({
      url: result.url,
      fileId: result.fileId,
      name: result.name
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRODUTOS ====================

// Listar produtos (público)
app.get('/api/produtos', async (req, res) => {
  try {
    const { categoria, genero, search, destaque, tendencia, novo } = req.query;
    
    let query = supabase
      .from('produtos')
      .select(`
        *,
        categorias(id, nome, slug)
      `)
      .eq('ativo', true)
      .order('created_at', { ascending: false });
    
    if (categoria) query = query.eq('categoria_id', categoria);
    if (genero) query = query.eq('genero', genero);
    if (search) query = query.ilike('nome', `%${search}%`);
    if (destaque === 'true') query = query.eq('destaque', true);
    if (tendencia === 'true') query = query.eq('tendencia', true);
    if (novo === 'true') query = query.eq('novo', true);
    
    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Buscar produto (público)
app.get('/api/produtos/:id', async (req, res) => {
  try {
    const { data: produto, error } = await supabase
      .from('produtos')
      .select(`
        *,
        categorias(id, nome, slug)
      `)
      .eq('id', req.params.id)
      .eq('ativo', true)
      .single();
    
    if (error) throw error;

    res.json(produto);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Criar produto (Admin)
app.post('/api/produtos', adminAuth, async (req, res) => {
  try {
    const produto = req.body;
    
    produto.slug = produto.nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');

    const { data, error } = await supabase
      .from('produtos')
      .insert([produto])
      .select()
      .single();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Atualizar produto (Admin)
app.put('/api/produtos/:id', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('produtos')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deletar produto (Admin)
app.delete('/api/produtos/:id', adminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('produtos')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Produto deletado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ESTOQUE ====================

app.get('/api/produtos/:id/estoque', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('estoque')
      .select('*, tamanhos(id, nome)')
      .eq('produto_id', req.params.id);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/estoque', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('estoque')
      .insert([req.body])
      .select();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Adicionar múltiplos tamanhos de uma vez
app.post('/api/produtos/:id/estoque/batch', adminAuth, async (req, res) => {
  try {
    const { tamanhos } = req.body;
    const produto_id = req.params.id;
    
    const estoqueData = tamanhos.map(t => ({
      produto_id,
      tamanho_id: t.tamanho_id,
      quantidade: t.quantidade || 0
    }));

    const { data, error } = await supabase
      .from('estoque')
      .upsert(estoqueData, {
        onConflict: 'produto_id,tamanho_id'
      })
      .select();
    
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/estoque/:id', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('estoque')
      .update({ quantidade: req.body.quantidade })
      .eq('id', req.params.id)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/estoque/:id', adminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('estoque')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Estoque deletado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CARRINHO ====================

app.get('/api/carrinho', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('carrinho')
      .select(`
        *,
        produtos(id, nome, slug, preco, imagem_principal),
        tamanhos(id, nome)
      `)
      .eq('usuario_id', req.userId);
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/carrinho', auth, async (req, res) => {
  try {
    const { produto_id, tamanho_id, quantidade } = req.body;

    const { data, error } = await supabase
      .from('carrinho')
      .upsert([{
        usuario_id: req.userId,
        produto_id,
        tamanho_id,
        quantidade
      }], {
        onConflict: 'usuario_id,produto_id,tamanho_id'
      })
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/carrinho/:id', auth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('carrinho')
      .delete()
      .eq('id', req.params.id)
      .eq('usuario_id', req.userId);
    
    if (error) throw error;
    res.json({ message: 'Item removido' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CATEGORIAS E TAMANHOS ====================

app.get('/api/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/categorias', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categorias')
      .insert([req.body])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categorias/:id', adminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Categoria deletada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tamanhos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tamanhos')
      .select('*')
      .order('ordem');
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CUPONS ====================

app.get('/api/cupons/validar/:codigo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cupons')
      .select('*')
      .eq('codigo', req.params.codigo.toUpperCase())
      .eq('ativo', true)
      .gte('validade', new Date().toISOString().split('T')[0])
      .single();
    
    if (error || !data) {
      return res.status(404).json({ error: 'Cupom inválido ou expirado' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cupons', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('cupons')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cupons', adminAuth, async (req, res) => {
  try {
    const cupom = { ...req.body, codigo: req.body.codigo.toUpperCase() };
    
    const { data, error } = await supabase
      .from('cupons')
      .insert([cupom])
      .select();
    
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cupons/:id', adminAuth, async (req, res) => {
  try {
    const cupom = { ...req.body, codigo: req.body.codigo.toUpperCase() };
    
    const { data, error } = await supabase
      .from('cupons')
      .update(cupom)
      .eq('id', req.params.id)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cupons/:id', adminAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('cupons')
      .delete()
      .eq('id', req.params.id);
    
    if (error) throw error;
    res.json({ message: 'Cupom deletado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== PEDIDOS ====================

app.get('/api/pedidos', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/pedidos/meus', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('usuario_id', req.userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pedidos/:id', adminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos')
      .update(req.body)
      .eq('id', req.params.id)
      .select();
    
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✨ Servidor rodando na porta ${PORT}`);
  console.log(`🔒 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});