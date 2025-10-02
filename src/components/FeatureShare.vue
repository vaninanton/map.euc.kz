<script setup>
import { ref, computed, watch } from 'vue'
import { encodeURI } from 'js-base64'

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    shareData: {
        type: Object,
        default: null,
    },
})

const emit = defineEmits(['close'])

const showTelegramLink = ref(false)
const countdown = ref(10)
const shareUrl = ref('')

const formattedJson = computed(() => {
    if (!props.shareData?.geoJson) return ''
    return ',' + JSON.stringify(props.shareData.geoJson, null, 4)
})

const generateShareUrl = () => {
    try {
        const jsonString = JSON.stringify(props.shareData)
        const base64Data = encodeURI(jsonString)
        shareUrl.value = `${window.location.origin}${window.location.pathname}#share=${base64Data}`

        // Обновляем URL в браузере
        // window.history.replaceState(null, '', shareUrl.value)
    } catch (error) {
        console.error('Ошибка при создании share URL:', error)
    }
}

// Следим за изменением shareData
watch(
    () => props.shareData,
    (newData) => {
        if (newData && props.visible) {
            generateShareUrl()
        }
    },
    { immediate: true },
)

const shareToTelegram = () => {
    try {
        const encodedMessage = encodeURIComponent(shareUrl.value)
        const telegramUrl = `https://t.me/vanton?text=${encodedMessage}`

        window.open(telegramUrl, '_blank')

        showTelegramLink.value = true
        countdown.value = 10

        const timer = setInterval(() => {
            countdown.value--
            if (countdown.value <= 0) {
                clearInterval(timer)
                handleClose()
            }
        }, 1000)
    } catch (error) {
        console.error('Ошибка при отправке в Telegram:', error)
        alert('Ошибка при создании ссылки. Проверьте консоль.')
    }
}

const copyShareLink = () => {
    navigator.clipboard
        .writeText(shareUrl.value)
        .then(() => {
            alert('Ссылка скопирована в буфер обмена!')
        })
        .catch((err) => {
            console.error('Ошибка при копировании:', err)
        })
}

const handleClose = () => {
    // Очищаем hash из URL
    // window.history.replaceState(null, '', window.location.pathname)
    showTelegramLink.value = false
    emit('close')
}
</script>

<template>
    <div v-if="visible && shareData" class="share-overlay">
        <div class="share-modal">
            <div class="share-header">
                <h2>
                    Объект создан!
                </h2>
                <button @click="handleClose" class="close-button">&times;</button>
            </div>

            <div class="share-content">
                <div v-if="shareData.name" class="info-section">
                    <h3>Название:</h3>
                    <p>{{ shareData.name }}</p>
                </div>

                <div v-if="shareData.description" class="info-section">
                    <h3>Описание:</h3>
                    <p>{{ shareData.description }}</p>
                </div>

                <div class="share-link-section">
                    <p>Для публикации отправь эту ссылку в тг <a href="https://t.me/vanton" target="_blank">@vanton</a> и мы её добавим!</p>
                    <div class="link-container">
                        <input type="text" :value="shareUrl" readonly class="share-link-input" />
                        <button @click="copyShareLink" class="copy-button">📋 Копировать</button>
                    </div>
                </div>

                <div class="info-section">
                    <h3>Данные GeoJSON:</h3>
                    <pre class="json-preview">{{ formattedJson }}</pre>
                </div>

                <div v-if="showTelegramLink" class="telegram-countdown">
                    <p>
                        Окно закроется через: <strong>{{ countdown }}</strong> сек.
                    </p>
                </div>
            </div>

            <div class="share-actions">
                <button @click="shareToTelegram" class="btn-telegram" :disabled="showTelegramLink">
                    <span class="telegram-icon">✈️</span> Отправить
                </button>
                <button @click="handleClose" class="btn-close">Закрыть</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.share-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
}

.share-modal {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.share-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #e0e0e0;
    background: #f5f5f5;
}

.share-header h2 {
    margin: 0;
    color: #333;
}

.close-button {
    background: none;
    border: none;
    font-size: 28px;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s;
}

.close-button:hover {
    background: #e0e0e0;
}

.share-content {
    padding: 20px;
    overflow-y: auto;
    flex-grow: 1;
}

.info-section {
    margin-bottom: 20px;
}

.info-section h3 {
    margin: 0 0 8px 0;
    color: #555;
    font-size: 14px;
    font-weight: 600;
}

.info-section p {
    margin: 0;
    color: #333;
}

.json-preview {
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 12px;
    overflow-x: auto;
    max-height: 100px;
    font-size: 12px;
    line-height: 1.4;
    color: #333;
    user-select: all;
}

.share-link-section {
    margin-bottom: 20px;
}
.share-link-section h3 {
    margin-top: 0;
}

.link-container {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}

.share-link-input {
    flex-grow: 1;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    background: #f9f9f9;
    user-select: all;
}

.copy-button {
    padding: 10px 16px;
    background: #e0e0e0;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
}

.copy-button:hover {
    background: #d0d0d0;
}

.telegram-countdown {
    background: #e3f2fd;
    padding: 12px;
    border-radius: 6px;
    margin-top: 16px;
    text-align: center;
}

.telegram-countdown p {
    margin: 0;
    color: #1976d2;
}

.telegram-countdown strong {
    font-size: 18px;
}

.share-actions {
    display: flex;
    gap: 12px;
    padding: 20px;
    border-top: 1px solid #e0e0e0;
    background: #f5f5f5;
}

.btn-telegram {
    flex-grow: 1;
    padding: 12px 24px;
    background: #0088cc;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.2s;
}

.btn-telegram:hover {
    background: #006699;
}

.btn-telegram:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.telegram-icon {
    font-size: 20px;
}

.btn-close {
    padding: 12px 24px;
    background: #e0e0e0;
    color: #333;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: background 0.2s;
}

.btn-close:hover {
    background: #d0d0d0;
}
</style>
