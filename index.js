const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de CORS para permitir solicitudes desde el frontend
app.use(cors());
app.use(express.json());

// Configuración de Multer para recibir la imagen en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Inicialización de la API Key de Gemini desde variables de entorno
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// RUTA PRINCIPAL: Procesar comprobante / ticket
app.post('/api/scan-ticket', upload.single('ticket'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo de imagen.' });
        }

        // Convertir el buffer de la imagen a formato aceptado por Gemini
        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString('base64'),
                mimeType: req.file.mimetype
            }
        };

        // Usar el modelo Gemini 1.5 Flash (ideal para visión rápida)
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Prompt estricto para forzar respuesta en formato JSON limpio
        const prompt = `
            Analiza esta imagen de un comprobante o ticket de compra y extrae la siguiente información.
            Responde ÚNICAMENTE con un objeto JSON válido sin bloques de código markdown ni texto adicional.
            
            Estructura requerida:
            {
              "amount": número (monto total final como flotante o entero, solo el número),
              "desc": "string corta con el nombre del comercio o concepto principal",
              "category": "string (elige obligatoriamente una de estas: 'Varios', 'Almacén', 'Limpieza', 'Servicios', 'Salud')",
              "payment": "string (elige 'Efectivo' o 'Transferencia' según lo que indique el ticket, por defecto 'Efectivo')"
            }
        `;

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text().trim();

        // Limpiar posible formato Markdown en la respuesta
        const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanJsonString);

        res.json(parsedData);

    } catch (error) {
        console.error('Error al procesar el ticket con Gemini:', error);
        res.status(500).json({ 
            error: 'Ocurrió un error al analizar la imagen.',
            details: error.message 
        });
    }
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('Servidor de escaneo de tickets activo.');
});

app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});