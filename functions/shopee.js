const crypto = require('crypto');

const BLACKLIST_KEYWORDS = [
    // Cursos, apostas e conteúdos digitais não autorizados
    'curso', 'e-book', 'ebook', 'rifa', 'apostas', 'cassino', 'grupo vip',

    // Conteúdo adulto
    'adulto', 'sex', 'vibrador', '18+', 'erótico', 'erotico', 'lingerie sensual',

    // Alimentos e bebidas
    'comida', 'bebida', 'bebidas', 'álcool', 'alcool', 'bebidas alcoólicas', 'bebidas alcoolicas',
    'fast-food', 'fastfood', 'pizza', 'hamburguer', 'hambúrguer', 'sanduíche', 'sanduiche',

    // Produtos para casa (excluídos)
    'tapetes', 'tapete', 'cortina', 'cortinas', 'roupa de cama', 'toalha', 'toalhas',

    // Peças e acessórios para veículos
    'pneus', 'pneu', 'pneu de carro', 'pneu de moto', 'pneu de bicicleta',
    'peças de carro', 'peças de moto', 'peças de bicicleta', 'peças automotivas',
    'peças para carros', 'peças para motos', 'peças para bicicletas',

    // Brinquedos e games
    'brinquedos', 'brinquedo', 'boneca', 'bonecas', 'jogo de tabuleiro', 'jogos de tabuleiro',
    'videogame', 'video game', 'console de videogame', 'consoles de videogame',

    // Sinais e placas
    'sinais',

    // ===== NOVOS TERMOS: LIVROS E PRODUTOS RELACIONADOS A BRUXARIA, FEITIÇOS, MACUMBA, MAGIA NEGRA E RITUAIS =====
    // Livros (geral e específicos)
    'livro', 'livros', 'livro usado', 'livros usados', 'livro de magia', 'livros de magia',
    'livro de feitiços', 'livros de feitiços', 'livro de bruxaria', 'livros de bruxaria',
    'livro de macumba', 'livros de macumba', 'livro de magia negra', 'livros de magia negra',
    'livro de rituais', 'livros de rituais', 'livro esotérico', 'livros esotéricos',

    // Bruxaria e feitiços
    'bruxaria', 'bruxa', 'bruxo', 'feitiço', 'feitiços', 'feitiçaria', 'magia', 'mágica',
    'magia negra', 'magia branca', 'ritual', 'rituais', 'ritualístico', 'ritualistica',

    // Macumba e religiões afros (se quiser bloquear)
    'macumba', 'umbanda', 'candomblé', 'candomblé', 'quimbanda', 'exu', 'pombagira',
    'orixá', 'orixás', 'santo daime', 'ayahuaska', 'chá de cogumelo',

    // Produtos relacionados
    'amuleto', 'amuletos', 'talismã', 'talismãs', 'cristal mágico', 'cristais mágicos',
    'vela de magia', 'velas de magia', 'vela ritualística', 'velas ritualísticas',
    'incenso mágico', 'incensos mágicos', 'pó de magia', 'pós de magia',
    'kit de bruxaria', 'kit de magia', 'kit de ritual', 'kit esotérico',

    // Termos em inglês (para abrangência)
    'witchcraft', 'spell', 'spells', 'black magic', 'dark magic', 'occult', 'occultism',
    'grimoire', 'book of spells', 'witch book', 'magic book', 'ritual book',
    'voodoo', 'voodoo doll', 'hex', 'curse', 'cursed', 'amuleto', 'talisman',
];
exports.handler = async (event, context) => {
    const appId = process.env.SHOPEE_APP_ID;
    const appSecret = process.env.SHOPEE_APP_SECRET;

    if (!appId || !appSecret) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: "Credenciais não configuradas no painel do Netlify." })
        };
    }

    const params = event.queryStringParameters || {};

    const page = parseInt(params.page) || 1;
    const limit = parseInt(params.limit) || 30;
    
    // Comissão mínima padrão de 11% (0.11 na API da Shopee)
    const minCommission = params.minCommission ? parseFloat(params.minCommission) : 0.11;
    
    const categoryId = params.categoryId ? parseInt(params.categoryId) : null;
    const minPrice = params.minPrice ? parseFloat(params.minPrice) : null;
    const maxPrice = params.maxPrice ? parseFloat(params.maxPrice) : null;
    
    // sortType 2 = Mais Vendidos / Volume de Vendas
    const sortType = params.sortType ? parseInt(params.sortType) : 2; 

    const timestamp = Math.floor(Date.now() / 1000);

    // Monta os argumentos de filtro do GraphQL
    let filterArgs = `page: ${page}, limit: ${limit}, sortType: ${sortType}, minCommissionRate: ${minCommission}`;
    if (categoryId) filterArgs += `, categoryId: ${categoryId}`;
    if (minPrice) filterArgs += `, minPrice: ${minPrice}`;
    if (maxPrice) filterArgs += `, maxPrice: ${maxPrice}`;

    const query = `query { shopeeOfferV2(${filterArgs}) { nodes { itemId itemCustomId imageUrl offerLink offerName commissionRate price } } }`;

    const payload = JSON.stringify({ query });

    const factor = appId + timestamp + payload + appSecret;
    const signature = crypto.createHash('sha256').update(factor).digest('hex');

    try {
        const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`
            },
            body: payload
        });

        const data = await response.json();

        // Aplica a Lista Negra nos resultados retornados
        if (data && data.data && data.data.shopeeOfferV2 && data.data.shopeeOfferV2.nodes) {
            data.data.shopeeOfferV2.nodes = data.data.shopeeOfferV2.nodes.filter(item => {
                const nameLower = (item.offerName || '').toLowerCase();
                // Retorna verdadeiro se o nome do produto NAO contiver nenhuma palavra da lista negra
                return !BLACKLIST_KEYWORDS.some(keyword => nameLower.includes(keyword));
            });
        }

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};