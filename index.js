const axios = require('axios');
const cheerio = require('cheerio');
const uuid = require('uuid').v4;
const fs = require('fs');
const { exit } = require('process');
const { exec } = require("child_process");
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, printf } = format;

const out = {
  bsp: '../serverfiles/csgo/maps',
  bz2: '../public_html/fastdl/maps'
}

const map = {
  list: '../serverfiles/csgo/maplist.txt',
  circle: '../serverfiles/csgo/mapcycle.txt',
}

const downloader = {
  workshop: 'http://steamworkshop.download/download/view/',
  gamebanana: 'https://files.gamebanana.com/maps/',
}

const preventDuplicata = (mapName) => {
  logger.info('Map is : %s', mapName);
  const maplist = fs.readFileSync(map.list);
  if(maplist.toString().match(new RegExp(`^${mapName}$`, "m"))) {
    logger.info('Map is already installed');
    exit();
  };
}

const addMaptofiles = (mapName) => {
  logger.info('Add map to files');

  fs.appendFileSync(map.list, `\n${mapName}`);
  fs.appendFileSync(map.circle, `\n${mapName}`);

  logger.info('Enjoy the Game');
  exit();
}

const clean = (path, fileName) => {
  logger.info('Clean and sort');
  exec(`mv ${path}/${fileName}.bsp ${out.bsp}`, () => {
    exec(`mv ${path}/${fileName}.bsp.bz2 ${out.bz2}`, () => {
      exec(`rm -Rf ${path}`, () => {
        addMaptofiles(fileName);
      });
    });
  })
}

const compressFile = (path) => {
  logger.info('Starting compress bz2');
  const targetFile = fs.readdirSync(path).find(file => file.match(/\.bsp$/));
  const targetFileName = targetFile.match(/^(.+)\.bsp$/)[1];
  exec(`bzip2 -k ${path}/${targetFile}`, () => {
    clean(path, targetFileName);
  });
  
}

const dealFile = (path, fileName) => {
  logger.info('Deal with file');
  

  const search = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = search[1];
  
  if(ext === 'bsp') compressFile(path);
  else if (ext === 'zip') {
    logger.info('Uncompress ZIP');
    exec(`unzip ${path}/${fileName} -d ${path}`, (err) => {
      if(err) logger.error(err);
      logger.info('ZIP uncompressed');
      compressFile(path);
    });
  } else if (ext === 'rar') {
    logger.info('Uncompress RAR');
    exec(`unrar x ${path}/${fileName} ${path}`, (err) => {
      if(err) logger.error(err);
      logger.info('RAR uncompressed');
      compressFile(path);
    });
  }
}

const download = (uri, name) => {
  logger.info('Create tmp directory');

  const workingDir = uuid();
  exec(`mkdir ${workingDir}`);

  logger.info('Starting download');

  return axios({ mathod: 'get', url: uri, responseType: 'stream' }).then(res => {
    res.data.pipe(fs.createWriteStream(`${workingDir}/${name}`));
    res.data.on('end', () => dealFile(workingDir, name));
  })
}

const downloadWorkshop = () => {
  logger.info('Detect WorkShop');

  const ws = uri.match(/\?id=([0-9]+)/);

  const id = ws[1];

  axios.get(`${downloader['workshop']}${id}`).then((res) => {
    const cheer = cheerio.load(res.data);

    const search = cheer('a[title]');

    const mapName = search[0].attribs.title;
    const mapUri = search[0].attribs.href;

    // const fileNameSearch = cheer('b')[0].children;
    // const fileNameToParse = fileNameSearch[fileNameSearch.length - 1].data;
    // const fileName = fileNameToParse.match(/([a-zA-Z_0-9]+\.[a-zA-Z0-9]+)/)[1];
    // Bad filename from the site... Need to use api workshop directly
    
    preventDuplicata(mapName);
    download(mapUri, `${mapName}.zip`);
  })
}

const downloadGamebanana = () => {
  logger.info('Detect Game Banana');


  axios.get(uri).then((res) => {
    const cheer = cheerio.load(res.data);

    const search = cheer('code');
    console.log(search);
    return;
    const fileName = search[0].children[0].data;
    const mapUri = `${downloader['gamebanana']}${fileName}`;
    const mapName = fileName.match(/^([a-zA-Z_0-9]+)\.[a-zA-Z0-9]+$/)[1];
    
    preventDuplicata(mapName);
    download(mapUri, fileName);
  })
}

const init = () => {
  logger.info('Init');

  if(!uri) {
    logger.error('usage : index.js *url*');
    process.exit();
  }

  if(uri.match(/steamcommunity\.com\/sharedfiles\/filedetails\/\?id=[0-9]+/)) return downloadWorkshop();
  else if(uri.match(/gamebanana\.com\/maps\/download\/[0-9]+/)) return downloadGamebanana();
}


const loggerFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});
 

const logger = createLogger({
  format: combine(
    format.splat(),
    label({ label: 'map-downloader' }),
    timestamp(),
    loggerFormat
  ),
  transports: [new transports.Console()]
});

const uri = process.argv[2];

const textDep = 'You need install dependencies %s. Try sudo apt install %s'

exec('bzip2 -h', (err) => {
  if(err) {
    logger.error(textDep, 'bzip2', 'bzip2');
    exit()
  }
  exec('unzip -h', (err) => {
    if(err) {
      logger.error(textDep, 'unzip', 'unzip');
      exit()
    }
    exec('unrar -v', (err) => {
      if(err) {
        logger.error(textDep, 'unrar', 'unrar');
        exit()
      }
      if(!fs.existsSync(out.bsp)) fs.mkdirSync(out.bsp);
      if(!fs.existsSync(out.bz2)) fs.mkdirSync(out.bz2);
      init();
    });
  });
});


