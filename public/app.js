// Configuração
const API_URL = 'http://localhost:3000/api';

// Estado da aplicação
let state = {
  produtos: [],
  produtosFiltrados: [],
  categorias: [],
  carrinho: [],
  filtros: {
    categoria: null,
    genero: null,
    preco: 500,
    busca: ''
  },
  produtoSelecionado: null,
  usuario: null,
  token: null,
  cupomAplicado: null,
  desconto: 0
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
  initApp();
  attachEventListeners();
});

// ==================== AUTENTICAÇÃO ====================

function verificarAutenticacao() {
  const token = localStorage.getItem('token');
  const usuario = localStorage.getItem('usuario');
  
  if (token && usuario) {
    state.token = token;
    state.usuario = JSON.parse(usuario);
    atualizarUIUsuario();
  }
}

function atualizarUIUsuario() {
  const userInfo = document.getElementById('userInfo');
  const userBtn = document.getElementById('userBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const myOrdersBtn = document.getElementById('myOrdersBtn');
  const adminBtn = document.getElementById('adminBtn');
  
  if (state.usuario) {
    userInfo.textContent = `Olá, ${state.usuario.nome.split(' ')[0]}!`;
    userBtn.style.background = 'linear-gradient(135deg, #ff69b4 0%, #ff1493 100%)';
    userBtn.style.color = 'white';
    
    logoutBtn.style.display = 'block';
    myOrdersBtn.style.display = 'block';
    
    // Mostrar botão admin se for admin
    if (state.usuario.tipo === 'admin') {
      adminBtn.style.display = 'block';
    }
  } else {
    userInfo.textContent = 'Visitante';
    userBtn.style.background = '#f5f5f5';
    userBtn.style.color = '#333';
    logoutBtn.style.display = 'none';
    myOrdersBtn.style.display = 'none';
    adminBtn.style.display = 'none';
  }
}

function getAuthHeaders() {
  if (state.token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`
    };
  }
  return {
    'Content-Type': 'application/json'
  };
}

async function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  state.token = null;
  state.usuario = null;
  state.carrinho = [];
  atualizarUIUsuario();
  atualizarCarrinho();
  window.location.href = '/login.html';
}

// ==================== INICIALIZAÇÃO ====================

async function initApp() {
  try {
    await carregarCategorias();
    await carregarProdutos();
    if (state.usuario) {
      await carregarCarrinhoServidor();
    } else {
      carregarCarrinhoLocal();
    }
    atualizarCarrinho();
  } catch (error) {
    console.error('Erro ao inicializar:', error);
  }
}

// ==================== EVENT LISTENERS ====================

function attachEventListeners() {
  // Menu mobile
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('nav').classList.toggle('active');
  });

  // Navegação
  document.querySelectorAll('.nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = e.target.dataset.page;
      navegarPara(page);
    });
  });

  // User menu
  document.getElementById('userBtn').addEventListener('click', () => {
    if (!state.usuario) {
      window.location.href = '/login.html';
    } else {
      document.getElementById('userDropdown').classList.toggle('active');
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  document.getElementById('myOrdersBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '/pedidos.html';
  });

  // Busca
  document.getElementById('searchBtn').addEventListener('click', buscarProdutos);
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') buscarProdutos();
  });

  // Ordenação
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    ordenarProdutos(e.target.value);
  });

  // Filtro de preço
  document.getElementById('priceRange').addEventListener('input', (e) => {
    state.filtros.preco = parseInt(e.target.value);
    document.getElementById('priceValue').textContent = `R$ 0 - R$ ${e.target.value}`;
    aplicarFiltros();
  });

  // Carrinho
  document.getElementById('cartBtn').addEventListener('click', abrirCarrinho);
  document.getElementById('cartModalClose').addEventListener('click', fecharCarrinho);
  
  // Modal produto
  document.getElementById('modalClose').addEventListener('click', fecharModalProduto);

  // Adicionar ao carrinho
  document.getElementById('addToCartBtn').addEventListener('click', adicionarAoCarrinho);

  // Cupom
  document.getElementById('aplicarCupomBtn').addEventListener('click', aplicarCupom);

  // Checkout
  document.getElementById('checkoutBtn').addEventListener('click', finalizarCompra);

  // Fechar modal clicando fora
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Fechar dropdown ao clicar fora
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
      document.getElementById('userDropdown')?.classList.remove('active');
    }
  });
}

// ==================== API CALLS ====================

async function carregarCategorias() {
  try {
    const response = await fetch(`${API_URL}/categorias`);
    state.categorias = await response.json();
    renderizarFiltrosCategorias();
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
  }
}

async function carregarProdutos(filtros = {}) {
  try {
    mostrarSkeletonProdutos();
    const params = new URLSearchParams(filtros);
    const response = await fetch(`${API_URL}/produtos?${params}`);
    state.produtos = await response.json();
    state.produtosFiltrados = [...state.produtos];
    aplicarFiltros();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    esconderSkeleton();
  }
}

async function carregarProduto(id) {
  try {
    const response = await fetch(`${API_URL}/produtos/${id}`);
    return await response.json();
  } catch (error) {
    console.error('Erro ao carregar produto:', error);
    return null;
  }
}

async function carregarCarrinhoServidor() {
  try {
    const response = await fetch(`${API_URL}/carrinho`, {
      headers: getAuthHeaders()
    });
    
    if (response.ok) {
      const data = await response.json();
      state.carrinho = data.map(item => ({
        id: item.id,
        produto_id: item.produtos.id,
        nome: item.produtos.nome,
        preco: item.produtos.preco,
        tamanho: item.tamanhos.nome,
        tamanho_id: item.tamanhos.id,
        quantidade: item.quantidade,
        imagem: item.produtos.imagem_principal
      }));
    }
  } catch (error) {
    console.error('Erro ao carregar carrinho:', error);
  }
}

function carregarCarrinhoLocal() {
  const carrinho = localStorage.getItem('carrinho');
  if (carrinho) {
    state.carrinho = JSON.parse(carrinho);
  }
}

// ==================== RENDERIZAÇÃO ====================

function mostrarSkeletonProdutos() {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card"></div>
  `).join('');
}

function esconderSkeleton() {
  // Skeleton é substituído pelos produtos
}

function renderizarFiltrosCategorias() {
  const container = document.getElementById('categoryFilters');
  container.innerHTML = state.categorias.map(cat => `
    <label>
      <input type="checkbox" value="${cat.id}" onchange="filtrarPorCategoria('${cat.id}', this.checked)">
      ${cat.nome}
    </label>
  `).join('');
}

function renderizarProdutos() {
  const grid = document.getElementById('productsGrid');
  
  if (state.produtosFiltrados.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: #999;">Nenhum produto encontrado.</p>';
    return;
  }

  grid.innerHTML = state.produtosFiltrados.map(produto => `
    <div class="product-card" onclick="abrirModalProduto('${produto.id}')">
      <div style="position: relative;">
        <img class="product-image" src="${produto.imagem_principal}" alt="${produto.nome}" loading="lazy">
        ${produto.tendencia ? '<span class="product-badge">Tendências</span>' : ''}
      </div>
      <div class="product-card-info">
        <h3>${produto.nome}</h3>
        <div class="product-price">
          <span class="price-current">R$ ${produto.preco.toFixed(2)}</span>
          ${produto.preco_antigo ? `<span class="price-old">R$ ${produto.preco_antigo.toFixed(2)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

async function abrirModalProduto(id) {
  const produto = await carregarProduto(id);
  if (!produto) return;

  state.produtoSelecionado = produto;

  document.getElementById('modalMainImage').src = produto.imagem_principal;
  
  const thumbnails = document.getElementById('modalThumbnails');
  if (produto.imagens_adicionais && produto.imagens_adicionais.length > 0) {
    thumbnails.innerHTML = [produto.imagem_principal, ...produto.imagens_adicionais].map((img, i) => `
      <img src="${img}" onclick="trocarImagemPrincipal('${img}')" ${i === 0 ? 'class="active"' : ''}>
    `).join('');
  } else {
    thumbnails.innerHTML = '';
  }

  document.getElementById('modalBadge').textContent = produto.tendencia ? 'Tendências' : 'Destaque';
  document.getElementById('modalTitle').textContent = produto.nome;
  document.getElementById('modalPrice').textContent = `R$ ${produto.preco.toFixed(2)}`;
  document.getElementById('modalPriceOld').textContent = produto.preco_antigo ? `R$ ${produto.preco_antigo.toFixed(2)}` : '';
  document.getElementById('modalColor').textContent = produto.cor || 'Variado';

  try {
    const response = await fetch(`${API_URL}/produtos/${produto.id}/estoque`);
    const estoque = await response.json();
    
    document.getElementById('modalSizes').innerHTML = estoque.map(item => `
      <button class="size-btn" data-tamanho-id="${item.tamanhos.id}" data-tamanho="${item.tamanhos.nome}" ${item.quantidade === 0 ? 'disabled' : ''}>
        ${item.tamanhos.nome}
      </button>
    `).join('');

    document.querySelectorAll('.size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
  }

  document.getElementById('productModal').classList.add('active');
}

function fecharModalProduto() {
  document.getElementById('productModal').classList.remove('active');
  state.produtoSelecionado = null;
}

function trocarImagemPrincipal(imgUrl) {
  document.getElementById('modalMainImage').src = imgUrl;
  document.querySelectorAll('.product-thumbnails img').forEach(img => {
    img.classList.toggle('active', img.src === imgUrl);
  });
}

// ==================== CARRINHO ====================

async function adicionarAoCarrinho() {
  if (!state.produtoSelecionado) return;

  const tamanhoSelecionado = document.querySelector('.size-btn.active');
  if (!tamanhoSelecionado) {
    alert('Por favor, selecione um tamanho');
    return;
  }

  if (!state.usuario) {
    const item = {
      id: Date.now(),
      produto_id: state.produtoSelecionado.id,
      nome: state.produtoSelecionado.nome,
      preco: state.produtoSelecionado.preco,
      tamanho: tamanhoSelecionado.dataset.tamanho,
      tamanho_id: tamanhoSelecionado.dataset.tamanhoId,
      quantidade: 1,
      imagem: state.produtoSelecionado.imagem_principal
    };

    const existente = state.carrinho.find(i => 
      i.produto_id === item.produto_id && i.tamanho === item.tamanho
    );

    if (existente) {
      existente.quantidade++;
    } else {
      state.carrinho.push(item);
    }

    salvarCarrinhoLocal();
  } else {
    try {
      const response = await fetch(`${API_URL}/carrinho`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          produto_id: state.produtoSelecionado.id,
          tamanho_id: tamanhoSelecionado.dataset.tamanhoId,
          quantidade: 1
        })
      });

      if (response.ok) {
        await carregarCarrinhoServidor();
      } else {
        alert('Erro ao adicionar ao carrinho');
        return;
      }
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho:', error);
      alert('Erro ao adicionar ao carrinho');
      return;
    }
  }

  atualizarCarrinho();
  fecharModalProduto();
  
  const cartBtn = document.getElementById('cartBtn');
  cartBtn.style.transform = 'scale(1.2)';
  setTimeout(() => cartBtn.style.transform = 'scale(1)', 300);
}

function abrirCarrinho() {
  renderizarCarrinho();
  document.getElementById('cartModal').classList.add('active');
}

function fecharCarrinho() {
  document.getElementById('cartModal').classList.remove('active');
}

function renderizarCarrinho() {
  const container = document.getElementById('cartItems');
  
  if (state.carrinho.length === 0) {
    container.innerHTML = '<p class="cart-empty">Seu carrinho está vazio.</p>';
    return;
  }

  container.innerHTML = state.carrinho.map((item, index) => `
    <div class="cart-item">
      <img src="${item.imagem}" alt="${item.nome}">
      <div class="cart-item-info">
        <h4>${item.nome}</h4>
        <p>Tamanho: ${item.tamanho}</p>
        <div class="cart-item-quantity">
          <button class="qty-btn" onclick="alterarQuantidade(${index}, -1)">-</button>
          <span>${item.quantidade}</span>
          <button class="qty-btn" onclick="alterarQuantidade(${index}, 1)">+</button>
        </div>
      </div>
      <div class="cart-item-actions">
        <span class="price-current">R$ ${(item.preco * item.quantidade).toFixed(2)}</span>
        <button class="remove-btn" onclick="removerDoCarrinho(${index})">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function alterarQuantidade(index, delta) {
  const item = state.carrinho[index];
  item.quantidade += delta;
  
  if (item.quantidade <= 0) {
    removerDoCarrinho(index);
    return;
  }

  if (state.usuario && item.id) {
    try {
      await fetch(`${API_URL}/carrinho/${item.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ quantidade: item.quantidade })
      });
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
    }
  } else {
    salvarCarrinhoLocal();
  }

  atualizarCarrinho();
  renderizarCarrinho();
}

async function removerDoCarrinho(index) {
  const item = state.carrinho[index];

  if (state.usuario && item.id) {
    try {
      await fetch(`${API_URL}/carrinho/${item.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
    } catch (error) {
      console.error('Erro ao remover item:', error);
    }
  }

  state.carrinho.splice(index, 1);
  salvarCarrinhoLocal();
  
  // Resetar cupom se carrinho ficar vazio
  if (state.carrinho.length === 0) {
    state.cupomAplicado = null;
    state.desconto = 0;
  }
  
  atualizarCarrinho();
  renderizarCarrinho();
}

function atualizarCarrinho() {
  const subtotal = state.carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  const quantidade = state.carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  
  // Calcular desconto
  let desconto = 0;
  if (state.cupomAplicado) {
    if (state.cupomAplicado.tipo === 'percentual') {
      desconto = subtotal * (state.cupomAplicado.valor / 100);
    } else {
      desconto = state.cupomAplicado.valor;
    }
  }
  
  const total = Math.max(0, subtotal - desconto);
  
  document.getElementById('cartCount').textContent = quantidade;
  document.getElementById('cartSubtotal').textContent = `R$ ${subtotal.toFixed(2)}`;
  document.getElementById('cartTotal').textContent = `R$ ${total.toFixed(2)}`;
  document.getElementById('cartTotalItems').textContent = quantidade;
  
  // Mostrar/ocultar desconto
  if (state.cupomAplicado && desconto > 0) {
    document.getElementById('descontoDisplay').style.display = 'flex';
    document.getElementById('descontoValor').textContent = `- R$ ${desconto.toFixed(2)}`;
    document.getElementById('cupomCodigo').textContent = state.cupomAplicado.codigo;
  } else {
    document.getElementById('descontoDisplay').style.display = 'none';
  }
}

function salvarCarrinhoLocal() {
  localStorage.setItem('carrinho', JSON.stringify(state.carrinho));
}

// ==================== CUPOM ====================

async function aplicarCupom() {
  const codigo = document.getElementById('cupomInput').value.trim().toUpperCase();
  const statusDiv = document.getElementById('cupomStatus');
  
  if (!codigo) {
    mostrarStatusCupom('Digite um código de cupom', 'error');
    return;
  }
  
  if (state.carrinho.length === 0) {
    mostrarStatusCupom('Adicione produtos ao carrinho primeiro', 'error');
    return;
  }

  try {
    const btn = document.getElementById('aplicarCupomBtn');
    btn.disabled = true;
    btn.textContent = 'Validando...';

    const response = await fetch(`${API_URL}/cupons/validar/${codigo}`);
    
    if (!response.ok) {
      throw new Error('Cupom inválido ou expirado');
    }

    const cupom = await response.json();
    
    // Verificar valor mínimo
    const subtotal = state.carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    if (cupom.valor_minimo && subtotal < cupom.valor_minimo) {
      throw new Error(`Valor mínimo para este cupom é R$ ${cupom.valor_minimo.toFixed(2)}`);
    }

    state.cupomAplicado = cupom;
    
    let mensagem = '';
    if (cupom.tipo === 'percentual') {
      mensagem = `✅ Cupom aplicado! ${cupom.valor}% de desconto`;
    } else {
      mensagem = `✅ Cupom aplicado! R$ ${cupom.valor.toFixed(2)} de desconto`;
    }
    
    mostrarStatusCupom(mensagem, 'success');
    atualizarCarrinho();
    
    // Desabilitar input e botão após aplicar
    document.getElementById('cupomInput').disabled = true;
    btn.textContent = 'Cupom Aplicado';
    
  } catch (error) {
    mostrarStatusCupom(error.message, 'error');
    state.cupomAplicado = null;
    atualizarCarrinho();
  } finally {
    const btn = document.getElementById('aplicarCupomBtn');
    if (!state.cupomAplicado) {
      btn.disabled = false;
      btn.textContent = 'Aplicar Cupom';
    }
  }
}

function mostrarStatusCupom(mensagem, tipo) {
  const statusDiv = document.getElementById('cupomStatus');
  statusDiv.textContent = mensagem;
  statusDiv.style.display = 'block';
  statusDiv.style.background = tipo === 'success' ? '#d4edda' : '#f8d7da';
  statusDiv.style.color = tipo === 'success' ? '#155724' : '#721c24';
  statusDiv.style.border = tipo === 'success' ? '1px solid #c3e6cb' : '1px solid #f5c6cb';
}

function finalizarCompra() {
  if (state.carrinho.length === 0) {
    alert('Seu carrinho está vazio!');
    return;
  }

  if (!state.usuario) {
    alert('Você precisa fazer login para finalizar a compra');
    window.location.href = '/login.html';
    return;
  }

  const subtotal = state.carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
  let desconto = 0;
  
  if (state.cupomAplicado) {
    if (state.cupomAplicado.tipo === 'percentual') {
      desconto = subtotal * (state.cupomAplicado.valor / 100);
    } else {
      desconto = state.cupomAplicado.valor;
    }
  }
  
  const total = Math.max(0, subtotal - desconto);
  
  let mensagem = `Resumo da Compra:\n\n`;
  mensagem += `Itens: ${state.carrinho.length}\n`;
  mensagem += `Subtotal: R$ ${subtotal.toFixed(2)}\n`;
  if (desconto > 0) {
    mensagem += `Desconto (${state.cupomAplicado.codigo}): - R$ ${desconto.toFixed(2)}\n`;
  }
  mensagem += `Total: R$ ${total.toFixed(2)}\n\n`;
  mensagem += `Funcionalidade de checkout em desenvolvimento!`;
  
  alert(mensagem);
}

// ==================== NAVEGAÇÃO E FILTROS ====================

function navegarPara(page) {
  state.filtros.genero = null;
  
  switch(page) {
    case 'masculino':
      state.filtros.genero = 'masculino';
      document.getElementById('sectionTitle').textContent = 'Moda Masculina';
      break;
    case 'feminino':
      state.filtros.genero = 'feminino';
      document.getElementById('sectionTitle').textContent = 'Moda Feminina';
      break;
    case 'contato':
      window.location.href = '/contato.html';
      return;
    default:
      document.getElementById('sectionTitle').textContent = 'Produtos em Destaque';
  }
  
  const filtros = {};
  if (state.filtros.genero) filtros.genero = state.filtros.genero;
  carregarProdutos(filtros);
}

function buscarProdutos() {
  state.filtros.busca = document.getElementById('searchInput').value;
  aplicarFiltros();
}

function filtrarPorCategoria(id, checked) {
  if (checked) {
    state.filtros.categoria = id;
  } else {
    state.filtros.categoria = null;
  }
  aplicarFiltros();
}

function aplicarFiltros() {
  let produtosFiltrados = [...state.produtos];

  // Filtro de categoria
  if (state.filtros.categoria) {
    produtosFiltrados = produtosFiltrados.filter(p => 
      p.categoria_id === state.filtros.categoria
    );
  }

  // Filtro de preço
  produtosFiltrados = produtosFiltrados.filter(p => 
    p.preco <= state.filtros.preco
  );

  // Filtro de busca
  if (state.filtros.busca) {
    const termo = state.filtros.busca.toLowerCase();
    produtosFiltrados = produtosFiltrados.filter(p =>
      p.nome.toLowerCase().includes(termo) ||
      (p.descricao && p.descricao.toLowerCase().includes(termo))
    );
  }

  state.produtosFiltrados = produtosFiltrados;
  renderizarProdutos();
}

function ordenarProdutos(tipo) {
  let produtos = [...state.produtosFiltrados];
  
  switch(tipo) {
    case 'menor-preco':
      produtos.sort((a, b) => a.preco - b.preco);
      break;
    case 'maior-preco':
      produtos.sort((a, b) => b.preco - a.preco);
      break;
    case 'novos':
      produtos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
  }
  
  state.produtosFiltrados = produtos;
  renderizarProdutos();
}