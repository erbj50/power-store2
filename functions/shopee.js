const crypto = require('crypto');

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
    const minCommission = params.minCommission ? parseFloat(params.minCommission) : null;
    const minPrice = params.minPrice ? parseFloat(params.minPrice) : null;
    const maxPrice = params.maxPrice ? parseFloat(params.maxPrice) : null;
    
    const sortType = params.sortType ? parseInt(params.sortType) : 2; 

    const timestamp = Math.floor(Date.now() / 1000);

    let filterArgs = `page: ${page}, limit: ${limit}, sortType: ${sortType}`;
    if (categoryId) filterArgs += `, categoryId: ${categoryId}`;
    if (minCommission) filterArgs += `, minCommissionRate: ${minCommission}`;
    if (minPrice) filterArgs += `, minPrice: ${minPrice}`;
    if (maxPrice) filterArgs += `, maxPrice: ${maxPrice}`;

    // GraphQL corrigido com os nomes exatos aceitos pela API da Shopee
    const query = `query { shopeeOfferV2(${filterArgs}) { nodes { imageUrl offerLink offerName priceMin priceMax commissionRate ratingStar } } }`;

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