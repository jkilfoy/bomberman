import characters from "../characters/Characters"
import { Character } from "../characters/Characters"
import { GameMode } from "../core/GameConfig"
import { GridCoordinate } from '../core/GridSystem'
import { io, Socket } from 'socket.io-client'

interface NetworkRosterEntry {
    playerId: string
    characterKey: string
    spawn: GridCoordinate
    name?: string
}

export default class MenuScene extends Phaser.Scene {

    // Object to store character icons
    characterIcons: {[id: string] : Phaser.GameObjects.Image} = { }
    selectedCharacter: Character | null = null
    lobbySocket?: Socket
    waitingText?: Phaser.GameObjects.Text
    queuedPlayerId: string | undefined
    resultMessage: string | undefined


    constructor() {
      super('MenuScene')
    }

    init(data: { resultMessage?: string }) {
      this.resultMessage = data?.resultMessage
    }

    preload() {
        Object.values(characters).forEach(char => {
            this.load.image(char.key, char.path)
        })
    }

    create() {
        const headingStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: '24px',
            color: '#ffffff'
        }
        const subHeadingStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: '20px',
            color: '#cccccc'
        }

        if (this.resultMessage) {
            this.add.text(100, 40, this.resultMessage, { fontSize: '18px', color: '#ffdd55' });
        }

        this.add.text(100, 80, 'Welcome to BOMBERMAN', headingStyle)

        this.add.text(100, 130, 'Select Your Character:', subHeadingStyle)

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

        // Start Game button (networked arena)
        const startButtonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            color: '#00ff00',
            backgroundColor: '#134475ff',
            padding: { left: 10, right: 10, top: 10, bottom: 10 }
        }

        let startGameButton = this.add.text(100, 350, 'Start Game!', startButtonStyle);

        startGameButton.setInteractive({ useHandCursor: true });

        startGameButton.on('pointerup', () => this.joinArenaQueue());

        // Add some basic hover feedback
        startGameButton.on('pointerover', () => {
            startGameButton.setBackgroundColor('#0056c0ff');
        });

        startGameButton.on('pointerout', () => {
            startGameButton.setBackgroundColor('#134475ff');
        });


        // Practise mode button
        const practiseButtonStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            color: '#00ff00',
            backgroundColor: '#751313ff',
            padding: { left: 10, right: 10, top: 10, bottom: 10 }
        }

        let practiseButton = this.add.text(100, 415, 'Practise Mode', practiseButtonStyle);

        practiseButton.setInteractive({ useHandCursor: true });

        practiseButton.on('pointerup', () => {
            this.scene.start('GameScene', { 
                selectedCharacter: this.selectedCharacter,
                mode: GameMode.practise,
                networked: false
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
        this.setupLobbySocket()

    }

    selectCharacter(char: Character | null) {
        this.selectedCharacter = char
        this.updateCharacterHighlight()
    }

    updateCharacterHighlight() {
        Object.entries(this.characterIcons).forEach(([key, characterIcon]) => {
            characterIcon.setTint(key === this.selectedCharacter?.key ? 0xffd9ae : 0xffffff)
            characterIcon.setScale(key === this.selectedCharacter?.key ? characters[key].scale * 1.6 : characters[key].scale * 1.2)
        })
    }

    private setupLobbySocket() {
        if (this.lobbySocket) return
        this.lobbySocket = io('http://localhost:4000', { transports: ['websocket'] })
        this.lobbySocket.on('lobby:queued', ({ position, playerId }) => {
            this.queuedPlayerId = playerId
            this.showWaiting(`Waiting for players... (#${position})`)
        })

        this.lobbySocket.on('lobby:error', ({ error }) => {
            this.showWaiting(`Lobby error: ${error}`)
        })

        this.lobbySocket.on('match:start', ({ matchId, playerId, roster, initialSnapshot }) => {
            if (!this.queuedPlayerId) {
                this.queuedPlayerId = playerId
            }
            if (playerId !== this.queuedPlayerId) return
            this.hideWaiting()
            this.scene.start('GameScene', {
                selectedCharacter: this.selectedCharacter,
                mode: GameMode.arena,
                networked: true,
                playerId,
                matchId,
                socket: this.lobbySocket,
                roster,
                initialSnapshot
            })
        })
    }

    private joinArenaQueue() {
        if (!this.selectedCharacter) {
            this.selectedCharacter = characters['eric']
        }
        if (!this.lobbySocket) {
            this.showWaiting('Connecting to lobby...')
            this.setupLobbySocket()
        }
        this.showWaiting('Waiting for players...')
        this.lobbySocket?.emit('lobby:join', {
            characterKey: this.selectedCharacter?.key ?? 'eric',
        })
    }

    private showWaiting(message: string) {
        if (!this.waitingText) {
            this.waitingText = this.add.text(100, 520, '', { fontSize: '18px', color: '#ffcc00' })
        }
        this.waitingText.setText(message)
        this.waitingText.setVisible(true)
    }

    private hideWaiting() {
        this.waitingText?.setVisible(false)
    }

}
