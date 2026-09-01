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

    const timestamp = Math.floor(Date.now() / 1000);

    // Query da aba "Oferta de Produto" (productOfferV2)
    const query = `query {
        productOfferV2(page: ${page}, limit: ${limit}) {
            nodes {
                itemId
                productName
                price
                imageUrl
                offerLink
                commissionRate
            }
        }
    }`;

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

        const result = await response.json();

        // Extrai os produtos retornados do productOfferV2
        let items = result?.data?.productOfferV2?.nodes || [];

        // Aplica o filtro da lista negra pelo nome do produto
        items = items.filter(item => {
            const nameLower = (item.productName || '').toLowerCase();
            return !BLACKLIST_KEYWORDS.some(word => nameLower.includes(word));
        });

        // Formata o JSON de saída mapeado para o que o seu frontend espera
        const formattedNodes = items.map(item => ({
            itemId: item.itemId,
            offerName: item.productName,
            price: item.price ? `R$ ${parseFloat(item.price).toFixed(2).replace('.', ',')}` : "R$ --",
            imageUrl: item.imageUrl,
            offerLink: item.offerLink,
            commissionRate: item.commissionRate
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                data: {
                    shopeeOfferV2: {
                        nodes: formattedNodes
                    }
                }
            })
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