const crypto = require('crypto');

// Lista negra de palavras-chave
const BLACKLIST_KEYWORDS = [
    'curso', 'e-book', 'ebook', 'rifa', 'apostas', 'cassino', 
    'adulto', 'sex', 'vibrador', '18+', 'grupo vip', 'sinais'
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
    const categoryId = params.categoryId ? parseInt(params.categoryId) : null;
    const sortType = params.sortType ? parseInt(params.sortType) : 2; // 2 = Mais Vendidos

    const timestamp = Math.floor(Date.now() / 1000);

    let filterArgs = `page: ${page}, limit: ${limit}, sortType: ${sortType}`;
    if (categoryId) filterArgs += `, categoryId: ${categoryId}`;

    // Query estritamente compativel com o tipo ShopeeOfferV2
    const query = `query { shopeeOfferV2(${filterArgs}) { nodes { offerName imageUrl offerLink commissionRate } } }`;

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

        // Filtragem de palavras indesejadas e comissao >= 11%
        if (data && data.data && data.data.shopeeOfferV2 && data.data.shopeeOfferV2.nodes) {
            data.data.shopeeOfferV2.nodes = data.data.shopeeOfferV2.nodes.filter(item => {
                const nameLower = (item.offerName || '').toLowerCase();
                
                // 1. Filtro da Lista Negra
                const isBlacklisted = BLACKLIST_KEYWORDS.some(keyword => nameLower.includes(keyword));
                
                // 2. Normalização e checagem de comissão >= 11%
                let rate = parseFloat(item.commissionRate) || 0;
                if (rate < 1) rate = rate * 100;

                const hasMinCommission = rate >= 11;

                return !isBlacklisted && hasMinCommission;
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