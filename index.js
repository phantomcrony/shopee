const Discord = require('discord.js');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const mongoose = require('mongoose');
const https = require('https')
const scheme = require('./schema/scheme');
const {comparer} = require('./comparer/comparer');

const client = new Discord.Client();

client.on("ready", async () => {

    console.log(`Logged in as ${client.user.tag}!`);

    //Set Bot Presence in Discord
    client.user.setPresence({
        status: "online",
        activity: {
            // The message shown
            name: `${process.env.BOT_STATUS}`,
            // PLAYING, WATCHING, LISTENING, STREAMING
            type: "WATCHING"
        }
    });



    //Connecting to mongo db
    mongoose.connect(`${process.env.MONGODB_URL}`, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        useFindAndModify: false
    }).then(

        () => {
            //Tell Database is Connected
            console.log('Database is connected')
            //Set interval of scraping
            setInterval(ScrapSite, `${process.env.SCRAPE_INTERVAL}`);
        }, //If cannot connect to database
        err => {
            //Tell Database is no connected 
            console.log('Can not connect to the database' + err)
        }
    );

});

//Page Scroller
async function scroll(page){
    await page.evaluate(async () => {
        await new Promise(resolve => {
            // Adjust as necessary
            const y = 500, speed = 10;
            let heightScrolled = 0;

            setInterval(() => {
                window.scrollBy(0, y);
                heightScrolled += y;
                if (heightScrolled >= document.body.scrollHeight) {
                    resolve();
                }
            }, speed);
        });
    });
}


//Scrap Site
function ScrapSite() {

    //Pupetter 
    (async function Search() {

        try {

            //Set Flag value to check same data insertion
            let flag=false

            //Launch Browser
            const browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']});
            const [page] = await browser.pages();

            //Set Headers
            await page.setExtraHTTPHeaders({
            'user-agent': `${process.env.USER_AGENT}`
            });

            //Request URL
            await page.goto(`${process.env.SCRAPE_LINK}`, {
            //Setting
            waitUntil: 'networkidle0',
            timeout:0
            });

            //Wait for the DOM to be loaded
            await page.$x('//*[@id="modal"]/div[1]/div[1]/div/div[3]/div[1]/button');
            const elements = await page.$x('//*[@id="modal"]/div[1]/div[1]/div/div[3]/div[1]/button');

            //Bypass bot protection
            await elements[0].click()

            //Set scoller area
            await page.setViewport({
                width: 1200,
                height: 800 
            });

            //Scroll until the end of page
            await scroll(page);

            //Delay to load page
            await page.waitForTimeout(9000)

            //Parse HTML
            const html = await page.evaluate(() => document.querySelector('*').outerHTML);
            
            //Close page
            await page.close();
                    
            //Close browser
            await browser.close();
            
            //Cheerio 
            let $ = cheerio.load(html);
            let productNames = [];
            let pricesafter = [];
            let links = [];

            //Telgram Channel Details
            var token = "2013305151:AAHQBR-l5tE5bFVusl7bTQ35e3Yv7Rp_TUc";
            var chat_id = -1001782285448

            //Store Product Data
            let products = [];

            //Scrap Product Title
            $('.flash-sale-item-card__item-name-box').each((i, el) => {
                var title = $(el).attr('title').toLowerCase().replace(/[^\w\s]/g,"").replace(/(^\s+|\s+$)/g,"").replace(/\s+/g," ");
                productNames[i] = title.toUpperCase();
            });

            //Scrap Price
            $('.flash-sale-item-card__current-price.flash-sale-item-card__current-price--landing-page').each((i, el) => {
                pricesafter[i] = 'RM ' + $(el).find('.item-price-number').text();
            });

            //Scrap Link
            $('.flash-sale-item-card-link').each((i, el) => {
                links[i] = 'https://shopee.com.my' + $(el).attr('href');
            });

            //Store all products data in an array
            for (let i = 0; i < productNames.length; i++) {

                products.push({
                    'product_name': productNames[i],
                    'link': links[i],
                    'priceafter': pricesafter[i],
                });
            }

            //Take data fron mango DB to compare
            let data = []

            //Fetching all the previous data from mongoDB
            try {
                data = await scheme.find({}, '-_id -__v');
            }
            //If error fetching data from mongodb
            catch (err) {
                console.log("Unable to query the database", err)
            }

            let ProductData = {products:data}

            //Compare data in website and db
            let Products = comparer(products, ProductData.products);

            //If no new product detected
            if (Products.length < 1 || Products.length == 0 ) {
            } 
            else {
                //If new product detected
                if (Products.length > 0) {
                    for (let i = 0; i < Products.length; i++) {
                        //Add element
                        const element = Products[i];
                        
                        var text =  `[​​](https://www.freepnglogos.com/uploads/shopee-logo/logo-shopee-png-images-download-shopee-1.png) ***📌 ${Products[i].product_name}*** %0A 💵 ${Products[i].priceafter} %0A 🌎 ${Products[i].link}`

                        var sendurl = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${text}&parse_mode=markdown&disable_web_page_preview=false`;

                        //Add datas into embed fields
                        const productEmbed = new Discord.MessageEmbed()
                            //Set Author
                            .setAuthor(`${process.env.SITE_NAME} (${process.env.CATEGORY_NAME})`, `${process.env.BRANDING_LOGO}`, `${process.env.SCRAPE_LINK}`)
                            //Set message color
                            .setColor(`${process.env.COLOR}`)
                            //Set message title
                            .setTitle((`${Products[i].product_name}`).toUpperCase())
                            //Set message url
                            .setURL(`${Products[i].link}`)
                            //Set message thumbnail
                            .setThumbnail(`${process.env.THUMBNAIL} `)
                            //Set message Fields
                            .addFields(
                                { 
                                    name: 'Price:', 
                                    value: `${Products[i].priceafter}`, 
                                    inline:true 
                                },
                                { 
                                    name: 'Category:', 
                                    value: `${process.env.CATEGORY_NAME}`, 
                                    inline:true 
                                },
                                { 
                                    name: 'Region:', 
                                    value: `${process.env.REGION_SHOP}`, 
                                    inline:true 
                                },
                                { 
                                    name: 'Other Links:', 
                                    value: "[Cart]"+`(${process.env.CART_LINK})` + " | " + "[Checkout]" + "(https://shopee.com.my/cart)" + " | " + "[Home]" + "(https://shopee.com.my/)" + " | " + "[Sale]" + "(https://shopee.com.my/shocking_sale?)"
                                }
                            )
                            .setTimestamp()
                            .setFooter(`${process.env.BRANDING_WORD}`, `${process.env.BRANDING_LOGO}`);

                        //Check if same unique data exist
                        let d = await scheme.find({link: element.link});

                        //Check Link
                        if (d && d.length==0){
                            
                            if (client.channels.cache.get(`${process.env.DISCORD_CHANNEL_ID}`)){
                                //Try to insert data into MongoDB and send to discord
                                try{
                                    //Insert Data into MongoDB
                                    await scheme.insertMany([element])
                                    
                                    https.get(sendurl, (resp) => {

                                    }).on("error", (err) => {
                                        console.log("Error: " + err.message);w
                                    });

                                    //Delay for the http request
                                    await new Promise(resolve => setTimeout(resolve, 8000));
                                    
                                    //Post Message to  Discord channel
                                    client.channels.cache.get(`${process.env.DISCORD_CHANNEL_ID}`).send(productEmbed);

                                    //Set Flag to true
                                    flag=true
                                }
                                //Catch Errors inserting data
                                catch(e){
                                }
                            }
                        }
                    }
                    //Print Result
                    if (flag){
                    }
                    else{
                    }
                }
            }
        //If there is an error going to the website, etc
        } catch (err) {
            //If error occured
            console.error(err);
        }
    })();
}
//Discord Bot Token
client.login(`${process.env.DISCORD_BOT_TOKEN}`);
