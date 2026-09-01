const crypto = require('crypto');

// Lista negra de palavras-chave para filtrar itens indesejados
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
    const keyword = params.keyword ? params.keyword : "";

    const timestamp = Math.floor(Date.now() / 1000);

    // Filtros para listagem de PRODUTOS REAIS (productOfferV2)
    let filterArgs = `page: ${page}, limit: ${limit}`;
    if (categoryId) filterArgs += `, categoryId: ${categoryId}`;
    if (keyword) filterArgs += `, keyword: "${keyword}"`;

    // Query GraphQL buscando os dados exatos do produto
    const query = `query {
        productOfferV2(${filterArgs}) {
            nodes {
                itemId
                productName
                price
                imageUrl
                offerLink
                commissionRate
                sales
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

        const data = await response.json();

        // Processa os dados retornados do productOfferV2
        if (data && data.data && data.data.productOfferV2 && data.data.productOfferV2.nodes) {
            
            // Filtra palavras da lista negra
            const filteredNodes = data.data.productOfferV2.nodes.filter(item => {
                const nameLower = (item.productName || '').toLowerCase();
                return !BLACKLIST_KEYWORDS.some(word => nameLower.includes(word));
            });

            // Mapeia para padronizar as propriedades para o seu front-end
            const formattedNodes = filteredNodes.map(item => ({
                itemId: item.itemId,
                offerName: item.productName,
                price: item.price,
                imageUrl: item.imageUrl,
                offerLink: item.offerLink,
                commissionRate: item.commissionRate
            }));

            // Retorna no formato esperado pelo seu front
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