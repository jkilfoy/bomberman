import characters from "../characters/Characters"
import { Character } from "../characters/Characters"
import { GameMode } from "../core/GameConfig"

export default class MenuScene extends Phaser.Scene {

    // Object to store character icons
    characterIcons: {[id: string] : Phaser.GameObjects.Image} = { }
    selectedCharacter: Character | null = null


    constructor() {
      super('MenuScene')
    }

    preload() {
        Object.values(characters).forEach(char => {
            this.load.image(char.key, char.path)
        })
    }

    create() {
        this.add.text(100, 80, 'Welcome to BOMBERMAN', { fontSize: 24, fill: '#fff' })

        this.add.text(100, 130, 'Select Your Character:', { fontSize: 20, fill: '#ccc' })

        // Character selection area
        let x = 160
        const y = 240

        Object.values(characters).forEach(char => {
            const characterIcon = this.add.image(x, y, char.key).setInteractive({ useHandCursor: true })
            characterIcon.setScale(char.scale)

            this.characterIcons[char.key] = characterIcon

            characterIcon.on('pointerup', () => this.selectCharacter(char))

            x += 120 // spacing between icons
        })

        // Start Game button
        let startGameButton = this.add.text(100, 350, 'Start Game!', {
            fill: '#0f0',
            backgroundColor: '#134475ff',
            padding: 10 });

        startGameButton.setInteractive({ useHandCursor: true });

        startGameButton.on('pointerup', () => {
            this.scene.start('GameScene', { 
                selectedCharacter: this.selectedCharacter,
                mode: GameMode.arena
            })
        });

        // Add some basic hover feedback
        startGameButton.on('pointerover', () => {
            startGameButton.setBackgroundColor('#0056c0ff');
        });

        startGameButton.on('pointerout', () => {
            startGameButton.setBackgroundColor('#134475ff');
        });


        // Practise mode button
        let practiseButton = this.add.text(100, 415, 'Practise Mode', {
            fill: '#0f0',
            backgroundColor: '#751313ff',
            padding: 10 });

        practiseButton.setInteractive({ useHandCursor: true });

        practiseButton.on('pointerup', () => {
            this.scene.start('GameScene', { 
                selectedCharacter: this.selectedCharacter,
                mode: GameMode.practise
            })
        });

        // Add some basic hover feedback
        practiseButton.on('pointerover', () => {
            practiseButton.setBackgroundColor('#a70808ff');
        });

        practiseButton.on('pointerout', () => {
            practiseButton.setBackgroundColor('#751313ff');
        });

        // Visually mark the default character
        this.updateCharacterHighlight()

    }

    selectCharacter(char) {
        this.selectedCharacter = char
        this.updateCharacterHighlight()
    }

    updateCharacterHighlight() {
        Object.entries(this.characterIcons).forEach(([key, characterIcon]) => {
            characterIcon.setTint(key === this.selectedCharacter?.key ? 0xffd9ae : 0xffffff)
            characterIcon.setScale(key === this.selectedCharacter?.key ? characters[key].scale * 1.6 : characters[key].scale * 1.2)
        })
    }

}