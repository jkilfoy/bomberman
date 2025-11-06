export interface Character {
    key: string
    name: string
    path: string
    scale: number
} 

const characters: {[key: string]: Character} = {

    'luffy' :   {
        key: 'luffy',
        name: 'Luffy',
        path: 'src/assets/luffy.png',
        scale: 0.5
    },

    'sanji' :   {
        key: 'sanji',
        name: 'Sanji',
        path: 'src/assets/sanji.png',
        scale: 0.125
    },

    'zoro' :   {
        key: 'zoro',
        name: 'Zoro',
        path: 'src/assets/zoro.png',
        scale: 0.30
    },

    'eric' :   {
        key: 'eric',
        name: 'Eric',
        path: 'src/assets/eric.png',
        scale: 0.25
    },

    'cage' :   {
        key: 'cage',
        name: 'Nick Cage',
        path: 'src/assets/cage.png',
        scale: 0.1
    }
}

export default characters