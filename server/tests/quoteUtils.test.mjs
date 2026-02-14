import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuoteItem, EmailPayloadSchema, buildEmailText } from '../lib/quoteUtils.js';

test('normalizeQuoteItem preenche campos padrão', () => {
  const normalized = normalizeQuoteItem({
    nome_produto: '  Pastilha de Freio Dianteira  ',
    codigo_referencia: '',
    marca: ' Fras-le ',
    preco_unitario: '134.2',
    quantidade: 3,
  });

  assert.equal(normalized.nome_produto, 'Pastilha de Freio Dianteira');
  assert.equal(normalized.codigo_referencia, 'N/A');
  assert.equal(normalized.marca, 'Fras-le');
  assert.equal(normalized.preco_unitario, 134.2);
  assert.equal(normalized.quantidade, 3);
});

test('EmailPayloadSchema valida payload mínimo', () => {
  const result = EmailPayloadSchema.safeParse({
    to_email: 'compras@empresa.com',
    to_name: 'Fornecedor XPTO',
    from_name: 'Marcelo',
    subject: 'Cotação de Peças',
    message: 'Segue pedido',
    items: [{ nome_produto: 'Filtro de Óleo', marca: 'Tecfil', preco_unitario: 37.5 }]
  });

  assert.equal(result.success, true);
});

test('normalizeQuoteItem normaliza preço negativo e quantidade inválida', () => {
  const normalized = normalizeQuoteItem({
    nome_produto: 'Bomba de água',
    preco_unitario: -15.5,
    quantidade: 0,
  });

  assert.equal(normalized.preco_unitario, 0);
  assert.equal(normalized.quantidade, 1);
});

test('buildEmailText soma totais com quantidade corretamente', () => {
  const payload = {
    to_email: 'compras@empresa.com',
    to_name: 'Fornecedor XPTO',
    from_name: 'Marcelo',
    subject: 'Cotação',
    message: 'Segue pedido',
    items: [
      {
        nome_produto: 'Pastilha',
        codigo_referencia: 'PST-01',
        marca: 'Marca A',
        preco_unitario: 10,
        quantidade: 3,
      },
      {
        nome_produto: 'Disco',
        codigo_referencia: 'DSC-02',
        marca: 'Marca B',
        preco_unitario: 20,
        quantidade: 2,
      },
    ],
  };

  const text = buildEmailText(payload);

  assert.match(text, /Pastilha[\s\S]*Qtd: 3[\s\S]*Total: R\$ 30\.00/);
  assert.match(text, /Disco[\s\S]*Qtd: 2[\s\S]*Total: R\$ 40\.00/);
  assert.match(text, /💰 TOTAL: R\$ 70\.00/);
});

test('buildEmailText arredonda totais decimais para 2 casas', () => {
  const payload = {
    to_email: 'compras@empresa.com',
    to_name: 'Fornecedor XPTO',
    from_name: 'Marcelo',
    subject: 'Cotação',
    message: 'Segue pedido',
    items: [
      {
        nome_produto: 'Item A',
        codigo_referencia: 'A-01',
        marca: 'Marca A',
        preco_unitario: 10.335,
        quantidade: 1,
      },
      {
        nome_produto: 'Item B',
        codigo_referencia: 'B-01',
        marca: 'Marca B',
        preco_unitario: 0.105,
        quantidade: 3,
      },
    ],
  };

  const text = buildEmailText(payload);

  assert.match(text, /Item A[\s\S]*Total: R\$ 10\.34/);
  assert.match(text, /Item B[\s\S]*Total: R\$ 0\.32/);
  assert.match(text, /💰 TOTAL: R\$ 10\.65/);
});

test('buildEmailText mantém consistência com volume alto de itens', () => {
  const items = Array.from({ length: 200 }, (_, index) => {
    const unitPrice = Number((((index % 17) + 1) * 1.11).toFixed(3));
    const quantity = (index % 5) + 1;

    return {
      nome_produto: `Item ${index + 1}`,
      codigo_referencia: `REF-${index + 1}`,
      marca: `Marca ${index % 7}`,
      preco_unitario: unitPrice,
      quantidade: quantity,
    };
  });

  const expectedTotal = items
    .reduce((sum, item) => {
      const line = Math.round((item.preco_unitario * item.quantidade) * 100) / 100;
      return sum + line;
    }, 0);

  const expectedRounded = (Math.round(expectedTotal * 100) / 100).toFixed(2);

  const payload = {
    to_email: 'compras@empresa.com',
    to_name: 'Fornecedor XPTO',
    from_name: 'Marcelo',
    subject: 'Cotação',
    message: 'Segue pedido',
    items,
  };

  const text = buildEmailText(payload);

  assert.match(text, new RegExp(`💰 TOTAL: R\\$ ${expectedRounded.replace('.', '\\.')}`));
  assert.match(text, /Item 1/);
  assert.match(text, /Item 200/);
});

test('buildEmailText mantém total estável com valores extremos', () => {
  const payload = {
    to_email: 'compras@empresa.com',
    to_name: 'Fornecedor XPTO',
    from_name: 'Marcelo',
    subject: 'Cotação',
    message: 'Segue pedido',
    items: [
      {
        nome_produto: 'Preço Alto',
        codigo_referencia: 'HIGH-01',
        marca: 'Marca X',
        preco_unitario: 999999.999,
        quantidade: 999,
      },
      {
        nome_produto: 'Quantidade zero (normalizar)',
        codigo_referencia: 'ZERO-01',
        marca: 'Marca Y',
        preco_unitario: 10,
        quantidade: 0,
      },
      {
        nome_produto: 'Preço negativo (normalizar)',
        codigo_referencia: 'NEG-01',
        marca: 'Marca Z',
        preco_unitario: -20,
        quantidade: 5,
      },
    ],
  };

  // buildEmailText normaliza quantidade mínima para 1 e preço mínimo para 0.
  const expectedLine1 = Math.round(999999.999 * 999 * 100) / 100;
  const expectedLine2 = Math.round(10 * 1 * 100) / 100;
  const expectedLine3 = Math.round(0 * 5 * 100) / 100;
  const expectedTotal = Math.round((expectedLine1 + expectedLine2 + expectedLine3) * 100) / 100;

  const text = buildEmailText(payload);

  assert.match(text, /Preço Alto[\s\S]*Qtd: 999/);
  assert.match(text, /Quantidade zero \(normalizar\)[\s\S]*Qtd: 1/);
  assert.match(text, /Preço negativo \(normalizar\)[\s\S]*R\$ 0\.00/);
  assert.match(text, new RegExp(`💰 TOTAL: R\\$ ${expectedTotal.toFixed(2).replace('.', '\\.')}`));
});
