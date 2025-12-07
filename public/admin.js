const API_URL = 'http://localhost:3000/api';

let state = {
  token: null,
  usuario: null,
  currentProdutoId: null,
  currentCupomId: null,
  tamanhos: []
};

// ==================== AUTENTICAÇÃO E PROTEÇÃO ====================

function verificarAutenticacao() {
  const token = localStorage.getItem('token');
  const usuario = localStorage.getItem('usuario');
  
  if (!token || !usuario) {
    window.location.href = '/login.html';
    return false;
  }

  const user = JSON.parse(usuario);
  
  if (user.tipo !== 'admin') {
    alert('Acesso negado. Você não é um administrador.');
    window.location.href = '/';
    return false;
  }

  state.token = token;
  state.usuario = user;
  
  document.getElementById('adminUser').textContent = user.nome.split(' ')[0];
  
  return true;
}

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${state.token}`
  };
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/login.html';
}

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
  if (!verificarAutenticacao()) {
    return;
  }

  setTimeout(() => {
    initAdmin();
    attachAdminListeners();
    esconderLoadingScreen();
  }, 1000);
});

function esconderLoadingScreen() {
  document.getElementById('loadingScreen').classList.add('hidden');
  setTimeout(() => {
    document.getElementById('loadingScreen').style.display = 'none';
  }, 500);
}

async function initAdmin() {
  try {
    await carregarDashboard();
    await carregarCategorias();
    await carregarTamanhos();
  } catch (error) {
    console.error('Erro ao inicializar:', error);
    if (error.message.includes('401') || error.message.includes('403')) {
      alert('Sessão expirada. Faça login novamente.');
      logout();
    }
  }
}

async function carregarTamanhos() {
  try {
    const response = await fetch(`${API_URL}/tamanhos`);
    state.tamanhos = await response.json();
  } catch (error) {
    console.error('Erro ao carregar tamanhos:', error);
  }
}

// ==================== EVENT LISTENERS ====================

function attachAdminListeners() {
  document.querySelectorAll('.admin-sidebar a').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = e.target.dataset.section;
      navegarSecao(section);
    });
  });

  document.getElementById('searchProdutos')?.addEventListener('input', (e) => {
    filtrarProdutos(e.target.value);
  });
}

function navegarSecao(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.admin-sidebar a').forEach(l => l.classList.remove('active'));
  
  document.getElementById(sectionId).classList.add('active');
  document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');

  switch(sectionId) {
    case 'dashboard':
      carregarDashboard();
      break;
    case 'produtos':
      carregarProdutos();
      break;
    case 'categorias':
      carregarCategorias();
      break;
    case 'estoque':
      carregarEstoque();
      break;
    case 'pedidos':
      carregarPedidos();
      break;
    case 'cupons':
      carregarCupons();
      break;
  }
}

// ==================== DASHBOARD ====================

async function carregarDashboard() {
  try {
    const [produtos, pedidos] = await Promise.all([
      fetch(`${API_URL}/produtos`, { headers: getAuthHeaders() }).then(r => r.json()),
      fetch(`${API_URL}/pedidos`, { headers: getAuthHeaders() }).then(r => r.json())
    ]);

    document.getElementById('totalProdutos').textContent = produtos.length;

    const pendentes = pedidos.filter(p => p.status === 'pendente').length;
    document.getElementById('pedidosPendentes').textContent = pendentes;

    const mesAtual = new Date().getMonth();
    const totalMes = pedidos
      .filter(p => {
        const pedidoMes = new Date(p.created_at).getMonth();
        return pedidoMes === mesAtual && p.status !== 'cancelado';
      })
      .reduce((sum, p) => sum + parseFloat(p.total), 0);
    document.getElementById('totalVendido').textContent = `R$ ${totalMes.toFixed(2)}`;

    const hoje = new Date().toDateString();
    const vendasHoje = pedidos.filter(p => 
      new Date(p.created_at).toDateString() === hoje && p.status !== 'cancelado'
    ).length;
    document.getElementById('vendasDia').textContent = vendasHoje;

    const recentesList = document.getElementById('recentOrdersList');
    const recentes = pedidos.slice(0, 5);
    
    if (recentes.length === 0) {
      recentesList.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Nenhum pedido recente</p>';
    } else {
      recentesList.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Status</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            ${recentes.map(p => `
              <tr>
                <td>#${p.id.substr(0, 8)}</td>
                <td>${p.cliente_nome}</td>
                <td>R$ ${parseFloat(p.total).toFixed(2)}</td>
                <td><span class="badge badge-${getStatusClass(p.status)}">${p.status}</span></td>
                <td>${new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
  }
}

function getStatusClass(status) {
  switch(status) {
    case 'entregue': return 'success';
    case 'cancelado': return 'danger';
    case 'enviado': return 'warning';
    default: return 'warning';
  }
}

// ==================== PRODUTOS ====================

async function carregarProdutos() {
  try {
    const response = await fetch(`${API_URL}/produtos`, {
      headers: getAuthHeaders()
    });
    const produtos = await response.json();
    renderizarTabelaProdutos(produtos);
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    mostrarErro('Erro ao carregar produtos');
  }
}

function renderizarTabelaProdutos(produtos) {
  const tbody = document.getElementById('produtosTable');
  
  if (produtos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <span>📦</span>
          <p>Nenhum produto cadastrado</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = produtos.map(p => `
    <tr>
      <td><img src="${p.imagem_principal}" class="product-img" alt="${p.nome}"></td>
      <td>${p.nome}</td>
      <td>${p.categorias?.nome || '-'}</td>
      <td>R$ ${parseFloat(p.preco).toFixed(2)}</td>
      <td>
        <span class="badge ${p.ativo ? 'badge-success' : 'badge-danger'}">
          ${p.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-edit" onclick="editarProduto('${p.id}')">Editar</button>
          <button class="btn-sm" style="background: #17a2b8; color: white;" onclick="gerenciarEstoque('${p.id}')">📦 Estoque</button>
          <button class="btn-sm btn-delete" onclick="deletarProduto('${p.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filtrarProdutos(termo) {
  const rows = document.querySelectorAll('#produtosTable tr');
  rows.forEach(row => {
    const texto = row.textContent.toLowerCase();
    row.style.display = texto.includes(termo.toLowerCase()) ? '' : 'none';
  });
}

function abrirModalProduto(produtoId = null) {
  state.currentProdutoId = produtoId;
  document.getElementById('modalProdutoTitle').textContent = 
    produtoId ? 'Editar Produto' : 'Novo Produto';
  
  if (produtoId) {
    carregarDadosProduto(produtoId);
  } else {
    document.getElementById('formProduto').reset();
    document.getElementById('imagemPrincipalUrl').value = '';
  }

  carregarCategoriasSelect();
  document.getElementById('modalProduto').classList.add('active');
}

function fecharModalProduto() {
  document.getElementById('modalProduto').classList.remove('active');
  state.currentProdutoId = null;
}

async function carregarDadosProduto(id) {
  try {
    const response = await fetch(`${API_URL}/produtos/${id}`, {
      headers: getAuthHeaders()
    });
    const produto = await response.json();
    
    const form = document.getElementById('formProduto');
    form.nome.value = produto.nome;
    form.descricao.value = produto.descricao || '';
    form.preco.value = produto.preco;
    form.preco_antigo.value = produto.preco_antigo || '';
    form.categoria_id.value = produto.categoria_id || '';
    form.genero.value = produto.genero;
    form.cor.value = produto.cor || '';
    document.getElementById('imagemPrincipalUrl').value = produto.imagem_principal;
    form.destaque.checked = produto.destaque;
    form.tendencia.checked = produto.tendencia;
    form.novo.checked = produto.novo || false;
  } catch (error) {
    console.error('Erro ao carregar produto:', error);
    mostrarErro('Erro ao carregar produto');
  }
}

async function carregarCategoriasSelect() {
  try {
    const response = await fetch(`${API_URL}/categorias`);
    const categorias = await response.json();
    
    const select = document.getElementById('selectCategoria');
    select.innerHTML = '<option value="">Selecione...</option>' +
      categorias.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
  }
}

async function uploadImagem() {
  const fileInput = document.getElementById('uploadImage');
  const file = fileInput.files[0];
  
  if (!file) {
    alert('Selecione uma imagem primeiro');
    return;
  }

  const formData = new FormData();
  formData.append('image', file);

  try {
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Enviando...';

    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Erro ao fazer upload');
    }

    const data = await response.json();
    document.getElementById('imagemPrincipalUrl').value = data.url;
    alert('✅ Imagem enviada com sucesso!');
  } catch (error) {
    console.error('Erro no upload:', error);
    alert('Erro ao enviar imagem: ' + error.message);
  } finally {
    const btn = event.target;
    btn.disabled = false;
    btn.textContent = '📤 Fazer Upload';
  }
}

async function salvarProduto() {
  const form = document.getElementById('formProduto');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const produto = {
    nome: form.nome.value,
    descricao: form.descricao.value,
    preco: parseFloat(form.preco.value),
    preco_antigo: form.preco_antigo.value ? parseFloat(form.preco_antigo.value) : null,
    categoria_id: form.categoria_id.value || null,
    genero: form.genero.value,
    cor: form.cor.value,
    imagem_principal: document.getElementById('imagemPrincipalUrl').value,
    destaque: form.destaque.checked,
    tendencia: form.tendencia.checked,
    novo: form.novo.checked,
    ativo: true
  };

  try {
    const url = state.currentProdutoId 
      ? `${API_URL}/produtos/${state.currentProdutoId}`
      : `${API_URL}/produtos`;
    
    const method = state.currentProdutoId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(produto)
    });

    if (response.ok) {
      alert('Produto salvo com sucesso!');
      fecharModalProduto();
      carregarProdutos();
    } else {
      const error = await response.json();
      alert(error.error || 'Erro ao salvar produto');
    }
  } catch (error) {
    console.error('Erro ao salvar produto:', error);
    alert('Erro ao salvar produto');
  }
}

async function editarProduto(id) {
  abrirModalProduto(id);
}

async function deletarProduto(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;

  try {
    const response = await fetch(`${API_URL}/produtos/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      alert('Produto excluído com sucesso!');
      carregarProdutos();
    } else {
      alert('Erro ao excluir produto');
    }
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    alert('Erro ao excluir produto');
  }
}

// ==================== GERENCIAMENTO DE ESTOQUE ====================

async function gerenciarEstoque(produtoId) {
  state.currentProdutoId = produtoId;
  
  try {
    const response = await fetch(`${API_URL}/produtos/${produtoId}/estoque`, {
      headers: getAuthHeaders()
    });
    const estoqueAtual = await response.json();
    
    const container = document.getElementById('estoqueFormContainer');
    container.innerHTML = `
      <p style="margin-bottom: 20px; color: #666;">Configure a quantidade disponível para cada tamanho:</p>
      ${state.tamanhos.map(tamanho => {
        const itemEstoque = estoqueAtual.find(e => e.tamanho_id === tamanho.id);
        return `
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 10px;">
              <input type="checkbox" 
                id="tam_${tamanho.id}" 
                data-tamanho-id="${tamanho.id}"
                ${itemEstoque ? 'checked' : ''}>
              Tamanho ${tamanho.nome}
            </label>
            <input type="number" 
              id="qty_${tamanho.id}"
              min="0" 
              value="${itemEstoque ? itemEstoque.quantidade : 0}"
              ${!itemEstoque ? 'disabled' : ''}
              style="width: 100px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 5px; margin-left: 10px;">
          </div>
        `;
      }).join('')}
    `;
    
    state.tamanhos.forEach(tamanho => {
      const checkbox = document.getElementById(`tam_${tamanho.id}`);
      const input = document.getElementById(`qty_${tamanho.id}`);
      
      checkbox.addEventListener('change', () => {
        input.disabled = !checkbox.checked;
        if (checkbox.checked && input.value === '0') {
          input.value = '10';
        }
      });
    });
    
    document.getElementById('modalEstoque').classList.add('active');
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
    alert('Erro ao carregar estoque');
  }
}

function fecharModalEstoque() {
  document.getElementById('modalEstoque').classList.remove('active');
  state.currentProdutoId = null;
}

async function salvarEstoqueProduto() {
  const tamanhosSelecionados = [];
  
  state.tamanhos.forEach(tamanho => {
    const checkbox = document.getElementById(`tam_${tamanho.id}`);
    if (checkbox.checked) {
      const quantidade = parseInt(document.getElementById(`qty_${tamanho.id}`).value) || 0;
      tamanhosSelecionados.push({
        tamanho_id: tamanho.id,
        quantidade
      });
    }
  });

  if (tamanhosSelecionados.length === 0) {
    alert('Selecione pelo menos um tamanho');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/produtos/${state.currentProdutoId}/estoque/batch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ tamanhos: tamanhosSelecionados })
    });

    if (response.ok) {
      alert('Estoque atualizado com sucesso!');
      fecharModalEstoque();
      if (document.getElementById('estoque').classList.contains('active')) {
        carregarEstoque();
      }
    } else {
      alert('Erro ao atualizar estoque');
    }
  } catch (error) {
    console.error('Erro ao salvar estoque:', error);
    alert('Erro ao salvar estoque');
  }
}

// ==================== CATEGORIAS ====================

async function carregarCategorias() {
  try {
    const response = await fetch(`${API_URL}/categorias`);
    const categorias = await response.json();
    renderizarTabelaCategorias(categorias);
  } catch (error) {
    console.error('Erro ao carregar categorias:', error);
  }
}

function renderizarTabelaCategorias(categorias) {
  const tbody = document.getElementById('categoriasTable');
  
  if (categorias.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-state">
          <span>🏷️</span>
          <p>Nenhuma categoria cadastrada</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = categorias.map(c => `
    <tr>
      <td>${c.nome}</td>
      <td>${c.slug}</td>
      <td>${c.descricao || '-'}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-delete" onclick="deletarCategoria('${c.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function abrirModalCategoria() {
  const nome = prompt('Nome da categoria:');
  if (!nome) return;

  const slug = nome.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');

  const descricao = prompt('Descrição (opcional):');

  criarCategoria({ nome, slug, descricao: descricao || '' });
}

async function criarCategoria(categoria) {
  try {
    const response = await fetch(`${API_URL}/categorias`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(categoria)
    });

    if (response.ok) {
      alert('Categoria criada com sucesso!');
      carregarCategorias();
    } else {
      alert('Erro ao criar categoria');
    }
  } catch (error) {
    console.error('Erro ao criar categoria:', error);
    alert('Erro ao criar categoria');
  }
}

async function deletarCategoria(id) {
  if (!confirm('Tem certeza? Isso pode afetar produtos vinculados.')) return;

  try {
    const response = await fetch(`${API_URL}/categorias/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      alert('Categoria excluída!');
      carregarCategorias();
    }
  } catch (error) {
    console.error('Erro ao excluir categoria:', error);
  }
}

// ==================== ESTOQUE ====================

async function carregarEstoque() {
  try {
    const response = await fetch(`${API_URL}/produtos`, {
      headers: getAuthHeaders()
    });
    const produtos = await response.json();
    
    const tbody = document.getElementById('estoqueTable');
    tbody.innerHTML = '';

    for (const produto of produtos) {
      const estoqueResp = await fetch(`${API_URL}/produtos/${produto.id}/estoque`);
      const estoque = await estoqueResp.json();

      if (estoque.length === 0) {
        tbody.innerHTML += `
          <tr>
            <td>${produto.nome}</td>
            <td colspan="3">
              <em style="color: #999;">Nenhum tamanho cadastrado</em>
            </td>
          </tr>
        `;
      } else {
        estoque.forEach(item => {
          tbody.innerHTML += `
            <tr>
              <td>${produto.nome}</td>
              <td>${item.tamanhos.nome}</td>
              <td>
                <input type="number" value="${item.quantidade}" 
                  onchange="atualizarEstoque('${item.id}', this.value)"
                  style="width: 80px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 5px;">
              </td>
              <td>
                <span class="badge ${item.quantidade > 10 ? 'badge-success' : item.quantidade > 0 ? 'badge-warning' : 'badge-danger'}">
                  ${item.quantidade > 10 ? 'Em Estoque' : item.quantidade > 0 ? 'Baixo' : 'Esgotado'}
                </span>
              </td>
            </tr>
          `;
        });
      }
    }
  } catch (error) {
    console.error('Erro ao carregar estoque:', error);
  }
}

async function atualizarEstoque(id, quantidade) {
  try {
    const response = await fetch(`${API_URL}/estoque/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ quantidade: parseInt(quantidade) })
    });

    if (response.ok) {
      carregarEstoque();
    }
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
  }
}

// ==================== PEDIDOS ====================

async function carregarPedidos() {
  try {
    const response = await fetch(`${API_URL}/pedidos`, {
      headers: getAuthHeaders()
    });
    const pedidos = await response.json();
    renderizarTabelaPedidos(pedidos);
  } catch (error) {
    console.error('Erro ao carregar pedidos:', error);
  }
}

function renderizarTabelaPedidos(pedidos) {
  const tbody = document.getElementById('pedidosTable');
  
  if (pedidos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <span>🛒</span>
          <p>Nenhum pedido realizado</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pedidos.map(p => `
    <tr>
      <td>#${p.id.substr(0, 8)}</td>
      <td>${p.cliente_nome}</td>
      <td>R$ ${parseFloat(p.total).toFixed(2)}</td>
      <td>
        <select onchange="atualizarStatusPedido('${p.id}', this.value)" 
          style="padding: 6px 10px; border: 2px solid #e0e0e0; border-radius: 5px;">
          <option value="pendente" ${p.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="pago" ${p.status === 'pago' ? 'selected' : ''}>Pago</option>
          <option value="enviado" ${p.status === 'enviado' ? 'selected' : ''}>Enviado</option>
          <option value="entregue" ${p.status === 'entregue' ? 'selected' : ''}>Entregue</option>
          <option value="cancelado" ${p.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
        </select>
      </td>
      <td>${new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
      <td>
        <button class="btn-sm btn-edit" onclick="alert('Funcionalidade em desenvolvimento')">Ver Detalhes</button>
      </td>
    </tr>
  `).join('');
}

async function atualizarStatusPedido(id, novoStatus) {
  try {
    const response = await fetch(`${API_URL}/pedidos/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: novoStatus })
    });

    if (response.ok) {
      alert('Status atualizado!');
      carregarPedidos();
      carregarDashboard();
    }
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
  }
}

// ==================== CUPONS ====================

async function carregarCupons() {
  try {
    const response = await fetch(`${API_URL}/cupons`, {
      headers: getAuthHeaders()
    });
    const cupons = await response.json();
    renderizarTabelaCupons(cupons);
  } catch (error) {
    console.error('Erro ao carregar cupons:', error);
  }
}

function renderizarTabelaCupons(cupons) {
  const tbody = document.getElementById('cuponsTable');
  
  if (cupons.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <span>🎟️</span>
          <p>Nenhum cupom cadastrado</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = cupons.map(c => `
    <tr>
      <td><strong>${c.codigo}</strong></td>
      <td>${c.tipo === 'percentual' ? 'Percentual' : 'Fixo'}</td>
      <td>${c.tipo === 'percentual' ? c.valor + '%' : 'R$ ' + c.valor.toFixed(2)}</td>
      <td>${new Date(c.validade).toLocaleDateString('pt-BR')}</td>
      <td>
        <span class="badge ${c.ativo && new Date(c.validade) >= new Date() ? 'badge-success' : 'badge-danger'}">
          ${c.ativo && new Date(c.validade) >= new Date() ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-edit" onclick="editarCupom('${c.id}')">Editar</button>
          <button class="btn-sm btn-delete" onclick="deletarCupom('${c.id}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function abrirModalCupom() {
  state.currentCupomId = null;
  document.getElementById('modalCupomTitle').textContent = 'Novo Cupom';
  document.getElementById('formCupom').reset();
  const hoje = new Date().toISOString().split('T')[0];
  document.querySelector('#formCupom input[name="validade"]').min = hoje;
  document.getElementById('modalCupom').classList.add('active');
}

async function editarCupom(id) {
  try {
    const response = await fetch(`${API_URL}/cupons`, {
      headers: getAuthHeaders()
    });
    const cupons = await response.json();
    const cupom = cupons.find(c => c.id === id);
    
    if (!cupom) {
      alert('Cupom não encontrado');
      return;
    }

    state.currentCupomId = id;
    document.getElementById('modalCupomTitle').textContent = 'Editar Cupom';
    
    const form = document.getElementById('formCupom');
    form.codigo.value = cupom.codigo;
    form.tipo.value = cupom.tipo;
    form.valor.value = cupom.valor;
    form.valor_minimo.value = cupom.valor_minimo || 0;
    form.validade.value = cupom.validade;
    
    document.getElementById('modalCupom').classList.add('active');
  } catch (error) {
    console.error('Erro ao carregar cupom:', error);
    alert('Erro ao carregar cupom');
  }
}

function fecharModalCupom() {
  document.getElementById('modalCupom').classList.remove('active');
  state.currentCupomId = null;
}

async function salvarCupom() {
  const form = document.getElementById('formCupom');
  
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const cupom = {
    codigo: form.codigo.value.toUpperCase(),
    tipo: form.tipo.value,
    valor: parseFloat(form.valor.value),
    valor_minimo: parseFloat(form.valor_minimo.value) || 0,
    validade: form.validade.value,
    ativo: true
  };

  try {
    const url = state.currentCupomId 
      ? `${API_URL}/cupons/${state.currentCupomId}`
      : `${API_URL}/cupons`;
    
    const method = state.currentCupomId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(cupom)
    });

    if (response.ok) {
      alert('Cupom salvo com sucesso!');
      fecharModalCupom();
      carregarCupons();
    } else {
      const error = await response.json();
      alert(error.error || 'Erro ao salvar cupom');
    }
  } catch (error) {
    console.error('Erro ao salvar cupom:', error);
    alert('Erro ao salvar cupom');
  }
}

async function deletarCupom(id) {
  if (!confirm('Tem certeza que deseja excluir este cupom?')) return;

  try {
    const response = await fetch(`${API_URL}/cupons/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (response.ok) {
      alert('Cupom excluído!');
      carregarCupons();
    }
  } catch (error) {
    console.error('Erro ao excluir cupom:', error);
  }
}

// ==================== UTILIDADES ====================

function mostrarErro(mensagem) {
  alert(mensagem);
}