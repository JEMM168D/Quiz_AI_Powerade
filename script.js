// script.js (Completo y Actualizado - Default 10 preguntas - URLs GCF Placeholder)

// --- URLs de las Google Cloud Functions ---
// IMPORTANTE: Reemplaza estas URLs con las URLs reales de tus funciones desplegadas
const generateQuizFunctionUrl = 'PON_AQUI_LA_URL_DE_TU_FUNCION_generateQuiz';
const analyzeResultsFunctionUrl = 'PON_AQUI_LA_URL_DE_TU_FUNCION_analyzeResults';

// --- DOM Element References ---
const uploadSection = document.getElementById('upload-section');
const quizSection = document.getElementById('quiz-section');
const loadingMessage = document.getElementById('loading-message');
const resultSection = document.getElementById('result-section');
const questionArea = document.getElementById('question-area');

const documentUploadInput = document.getElementById('documentUpload');
const uploadButton = document.getElementById('uploadButton');
const numQuestionsInput = document.getElementById('numQuestions');
const startButton = document.getElementById('startButton');

// --- State Variables ---
let questions = []; // Preguntas originales de la IA {question, options, answer, topic}
let currentQuestionIndex = 0;
let score = 0;
let selectedQuizQuestions = []; // Las preguntas seleccionadas para ESTE quiz
let incorrectAnswers = []; // Guarda las preguntas falladas en este quiz {question, options, answer, topic}

// --- Initial Page Setup ---
window.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado. Ocultando secciones iniciales.");
    quizSection.style.display = 'none';
    loadingMessage.style.display = 'none';
    resultSection.style.display = 'none';
    questionArea.style.display = 'none';
});

// --- Event Listeners ---

// 1. Event Listener para el botón "Analizar Documento"
uploadButton.addEventListener('click', () => {
    console.log("--- Botón Analizar clickeado ---");
    const files = documentUploadInput.files;

    if (files.length === 0) {
        alert('Por favor, selecciona un archivo .txt, .pdf o .docx primero.');
        console.log("Validación: No se seleccionó archivo.");
        return;
    }

    const file = files[0];
    console.log("Archivo seleccionado:", file);
    console.log(`Nombre: ${file.name}, Tipo MIME reportado: ${file.type}, Tamaño: ${file.size}`);

    // Validar tamaño
    const maxSizeInBytes = 10 * 1024 * 1024; // 10 MB
    console.log("Validando tamaño...");
    if (file.size > maxSizeInBytes) {
        alert(`El archivo es demasiado grande (${(file.size / 1024 / 1024).toFixed(2)} MB). El límite es 10 MB.`);
        documentUploadInput.value = '';
        console.log("Validación: Archivo demasiado grande.");
        return;
    }

    // Tipos permitidos (más explícito con extensiones también)
    const allowedMimeTypes = [
        'text/plain',
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const allowedExtensions = ['.txt', '.pdf', '.docx'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    const isTypeAllowed = allowedMimeTypes.includes(file.type) || allowedExtensions.includes(fileExtension);

    console.log(`Validando tipo: MIME=${file.type}, Extensión=${fileExtension}, Permitido=${isTypeAllowed}`);

    // Validar tipo
    if (!isTypeAllowed) {
         alert(`Tipo de archivo no permitido (${file.type || 'desconocido'} / ${fileExtension}). Sube .txt, .pdf o .docx.`);
         documentUploadInput.value = '';
         console.log("Validación: Tipo de archivo no permitido.");
         return;
    }

    console.log("Validación pasada. Iniciando FileReader...");

    const reader = new FileReader();

    reader.onload = (e) => {
        console.log("--- reader.onload EJECUTADO ---");
        const fileDataUrl = e.target.result;
        console.log("Archivo leído como Data URL (primeros 100 chars):", fileDataUrl.substring(0,100));

        uploadSection.style.display = 'none';
        loadingMessage.style.display = 'block';
        quizSection.style.display = 'none';
        resultSection.style.display = 'none';
        questionArea.style.display = 'none';

        // Determinar tipo MIME a enviar (priorizar el detectado, si no, inferir de extensión)
        let typeToSend = file.type;
        if (!typeToSend && fileExtension === '.docx') {
            typeToSend = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            console.log("Tipo MIME vacío, infiriendo DOCX por extensión.");
        } else if (!typeToSend && fileExtension === '.pdf') {
             typeToSend = 'application/pdf';
             console.log("Tipo MIME vacío, infiriendo PDF por extensión.");
        } else if (!typeToSend && fileExtension === '.txt') {
            typeToSend = 'text/plain';
            console.log("Tipo MIME vacío, infiriendo TXT por extensión.");
        } else if (!typeToSend) {
            typeToSend = 'application/octet-stream'; // Genérico si todo falla
            console.warn(`Tipo MIME vacío y extensión no reconocida (${fileExtension}), usando genérico.`);
        }

        console.log(`Llamando a analyzeDocumentWithAI con tipo: ${typeToSend}`);
        // Asegurarse que las URLs no son los placeholders
        if (generateQuizFunctionUrl.startsWith('PON_AQUI_LA_URL')) {
             alert("Error de configuración: La URL de la función generateQuiz no ha sido configurada en script.js.");
             resetUIOnError();
             return;
        }
        analyzeDocumentWithAI(fileDataUrl, typeToSend, file.name);
    };

    reader.onerror = (e) => {
        console.error("--- reader.onerror EJECUTADO ---", e);
        alert('Error al leer el archivo localmente.');
        resetUIOnError();
    };

    console.log("Llamando a reader.readAsDataURL...");
    reader.readAsDataURL(file);
});

// 2. Event Listener para el botón "Empezar Quiz"
startButton.addEventListener('click', () => {
    const totalAvailableQuestions = questions.length;
    let requestedQuestions = parseInt(numQuestionsInput.value);

    console.log(`Botón 'Empezar Quiz'. Solicitadas: ${requestedQuestions}, Disponibles: ${totalAvailableQuestions}`);

    // Validar número solicitado (permitir hasta 30 o el máximo disponible)
    const maxAllowed = Math.min(30, totalAvailableQuestions);
     if (isNaN(requestedQuestions) || requestedQuestions <= 0) {
         alert(`Por favor, introduce un número positivo de preguntas.`);
         numQuestionsInput.value = Math.min(10, maxAllowed); // Reset a default
         return;
     }
     if (requestedQuestions > maxAllowed) {
          alert(`Solo hay ${totalAvailableQuestions} preguntas disponibles. El máximo permitido es ${maxAllowed}.`);
          requestedQuestions = maxAllowed; // Corregir al máximo permitido
          numQuestionsInput.value = requestedQuestions; // Actualizar input
     }


    // Reiniciamos estado del quiz específico
    currentQuestionIndex = 0;
    score = 0;
    incorrectAnswers = [];

    // Selección aleatoria
    const shuffledQuestions = [...questions].sort(() => Math.random() - 0.5);
    selectedQuizQuestions = shuffledQuestions.slice(0, requestedQuestions);

    console.log(`Iniciando quiz con ${selectedQuizQuestions.length} preguntas aleatorias.`);

    quizSection.style.display = 'none';
    resultSection.style.display = 'none';
    questionArea.innerHTML = '';
    questionArea.style.display = 'block';
    displayQuestion();
});

// --- Helper Functions ---

// Función para llamar a la función de generación de preguntas
async function analyzeDocumentWithAI(fileDataUrl, fileType, fileName) {
    console.log(`--- analyzeDocumentWithAI INICIADO para ${fileName} (Tipo: ${fileType}) ---`);
    loadingMessage.style.display = 'block';
    console.log("Preparando para llamar a fetch:", generateQuizFunctionUrl);

    try {
        console.log("Enviando fetch a generateQuiz...");
        const response = await fetch(generateQuizFunctionUrl, { // <-- URL de GCF
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ fileDataUrl: fileDataUrl, fileType: fileType, fileName: fileName }),
        });
        console.log("Fetch a generateQuiz completado. Estado:", response.status);

        const data = await response.json(); // Intenta parsear JSON incluso si no es OK, puede contener error

        if (!response.ok) {
            // Usar el mensaje de error del backend si está disponible
            const errorMessage = data?.error || `Error del servidor: ${response.status} ${response.statusText}`;
            console.error("Error recibido del backend:", errorMessage);
            throw new Error(errorMessage);
        }

        console.log("Respuesta JSON parseada de generateQuiz:", data);

        // Guardar preguntas
        questions = (data.questions && Array.isArray(data.questions)) ? data.questions : [];
        console.log(`${questions.length} preguntas recibidas y guardadas.`);

        if (questions.length === 0) {
             alert("La IA no pudo generar preguntas para este documento o el documento estaba vacío.");
             resetUIOnError();
             return;
        }

        loadingMessage.style.display = 'none';
        quizSection.style.display = 'block';
        questionArea.style.display = 'none';
        resultSection.style.display = 'none';

        // Ajustar el input de número de preguntas
        const maxSelectable = Math.min(30, questions.length); // Límite de 30 o las disponibles
        numQuestionsInput.max = maxSelectable; // Establecer el ATRIBUTO 'max'
        numQuestionsInput.value = Math.min(10, maxSelectable); // Default 10 o menos si no hay suficientes

        // Actualizar la etiqueta
        const label = document.querySelector('label[for="numQuestions"]');
        if(label) { label.textContent = `Número de preguntas (1-${maxSelectable}):`; }

        console.log(`Configuración del quiz mostrada. Máximo ${maxSelectable} preguntas seleccionables. Default: ${numQuestionsInput.value}`);

    } catch (error) {
        console.error("--- ERROR en analyzeDocumentWithAI o fetch a generateQuiz ---");
        console.error(error);
        // Mostrar el mensaje de error específico capturado
        alert(`Hubo un problema al generar el cuestionario: ${error.message}\nInténtalo de nuevo o revisa el documento.`);
        resetUIOnError();
        questions = [];
    }
} // <-- Fin de analyzeDocumentWithAI

// Función para mostrar la pregunta actual
function displayQuestion() {
    if (currentQuestionIndex >= selectedQuizQuestions.length) {
        showResults();
        return;
    }
    const currentQ = selectedQuizQuestions[currentQuestionIndex];
    questionArea.innerHTML = ''; // Limpiar área
    const questionCard = document.createElement('div');
    questionCard.classList.add('question-card');

    // Mostrar Tema (si existe)
    if (currentQ.topic) {
        const topicElement = document.createElement('p');
        topicElement.textContent = `Tema: ${currentQ.topic}`;
        topicElement.style.fontSize = '0.9em';
        topicElement.style.color = '#606770';
        topicElement.style.marginBottom = '15px';
        topicElement.style.borderBottom = '1px solid #eee';
        topicElement.style.paddingBottom = '5px';
        questionCard.appendChild(topicElement);
    }

    const questionText = document.createElement('p');
    questionText.classList.add('question-text');
    questionText.innerHTML = `<strong>Pregunta ${currentQuestionIndex + 1}/${selectedQuizQuestions.length}:</strong> ${currentQ.question}`;
    questionCard.appendChild(questionText);

    const optionsContainer = document.createElement('div');
    optionsContainer.classList.add('options-container');

    // Validar que options sea un array antes de barajar
    let optionsToShow = [];
    if (Array.isArray(currentQ.options)) {
        optionsToShow = [...currentQ.options].sort(() => Math.random() - 0.5);
    } else {
        console.error("Error: 'options' no es un array para la pregunta:", currentQ);
        // Opcional: mostrar un mensaje de error o saltar la pregunta
    }


    optionsToShow.forEach((option, index) => {
        const optionButton = document.createElement('button');
        optionButton.classList.add('option-button');
        optionButton.dataset.optionValue = option; // Guardar el valor original
        // Usar A, B, C, D... como prefijo
        optionButton.textContent = `${String.fromCharCode(65 + index)}) ${option}`;
        optionButton.addEventListener('click', handleAnswer);
        optionsContainer.appendChild(optionButton);
    });
    questionCard.appendChild(optionsContainer);
    questionArea.appendChild(questionCard);
}

// Función para manejar la respuesta seleccionada
function handleAnswer(event) {
    const selectedButton = event.target;
    const selectedAnswer = selectedButton.dataset.optionValue;
    const currentQ = selectedQuizQuestions[currentQuestionIndex];

    // Validar que 'answer' exista en la pregunta actual
    if (typeof currentQ.answer === 'undefined') {
         console.error("Error: Falta la propiedad 'answer' en la pregunta actual:", currentQ);
         alert("Error interno: La pregunta actual no tiene una respuesta definida.");
         // Podrías decidir avanzar a la siguiente pregunta o detener el quiz
         currentQuestionIndex++;
         displayQuestion();
         return;
    }

    const correctAnswer = currentQ.answer;
    console.log(`Pregunta ${currentQuestionIndex + 1}: Seleccionada: "${selectedAnswer}", Correcta: "${correctAnswer}"`);

    const allOptions = questionArea.querySelectorAll('.option-button');
    allOptions.forEach(button => {
        button.disabled = true; // Deshabilitar todos los botones
        // Comparar el valor original guardado en dataset
        if (button.dataset.optionValue === correctAnswer) {
            button.classList.add('correct');
        } else if (button === selectedButton) { // Marcar el incorrecto solo si fue el seleccionado
            button.classList.add('incorrect');
        }
    });

    if (selectedAnswer === correctAnswer) {
        score++;
        console.log("Respuesta CORRECTA");
    } else {
        console.log("Respuesta INCORRECTA.");
        // Guardar la pregunta completa (incluyendo tema) para análisis
        incorrectAnswers.push(currentQ);
        console.log("Pregunta incorrecta guardada:", currentQ);
    }

    // Pausa antes de mostrar la siguiente pregunta
    setTimeout(() => {
        currentQuestionIndex++;
        displayQuestion();
    }, 1500); // 1.5 segundos de pausa
}


// Función para mostrar los resultados finales y obtener feedback IA
async function showResults() {
    console.log("Mostrando resultados finales. Preparando para análisis de errores.");
    questionArea.style.display = 'none';
    resultSection.innerHTML = ''; // Limpiar resultados anteriores
    resultSection.style.display = 'block';

    const totalQuestions = selectedQuizQuestions.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    // Crear elementos de resultado
    const resultTitle = document.createElement('h2'); resultTitle.textContent = 'Resultados Finales';
    const scoreText = document.createElement('p'); scoreText.innerHTML = `Has acertado <strong>${score}</strong> de <strong>${totalQuestions}</strong> preguntas.`;
    const percentageText = document.createElement('p'); percentageText.innerHTML = `Porcentaje de aciertos: <strong>${percentage}%</strong>`;
    const feedbackPara = document.createElement('p'); feedbackPara.id = 'aiFeedbackParagraph';
    const feedbackEmphasis = document.createElement('em');
    feedbackEmphasis.textContent = incorrectAnswers.length > 0 ? "Generando análisis de errores con IA..." : "¡Felicidades! Ningún error.";
    feedbackPara.appendChild(feedbackEmphasis);

    // Crear botones
    const buttonContainer = document.createElement('div'); // Contenedor para botones
    buttonContainer.style.marginTop = '20px';

    const tryAgainButton = document.createElement('button');
    tryAgainButton.id = 'tryAgainButton'; tryAgainButton.textContent = 'Hacer otro quiz (mismo documento)';
    tryAgainButton.style.marginRight = '10px'; // Espacio entre botones (si están en línea)
    tryAgainButton.addEventListener('click', () => {
        console.log("Botón 'Hacer otro quiz' clickeado.");
        resultSection.style.display = 'none';
        quizSection.style.display = 'block'; // Mostrar sección de config quiz
        // Resetear valor del input al default (10 o max disponible)
        const maxSelectable = Math.min(30, questions.length);
        numQuestionsInput.max = maxSelectable;
        numQuestionsInput.value = Math.min(10, maxSelectable);
        const label = document.querySelector('label[for="numQuestions"]');
        if(label) label.textContent = `Número de preguntas (1-${maxSelectable}):`;
    });

    const restartButton = document.createElement('button');
    restartButton.id = 'restartButton'; restartButton.textContent = 'Analizar un documento nuevo';
    restartButton.addEventListener('click', () => {
        console.log("Botón 'Analizar un documento nuevo' clickeado.");
        // Resetear todo el estado
        questions = []; selectedQuizQuestions = []; incorrectAnswers = [];
        score = 0; currentQuestionIndex = 0;
        documentUploadInput.value = ''; // Limpiar input file
        resultSection.style.display = 'none';
        questionArea.style.display = 'none';
        quizSection.style.display = 'none';
        uploadSection.style.display = 'block'; // Mostrar sección de subida
        numQuestionsInput.value = 10; // Resetear input numérico a 10
        const label = document.querySelector('label[for="numQuestions"]');
        if(label) label.textContent = `Número de preguntas:`; // Resetear etiqueta
    });

    // Añadir elementos iniciales al DOM
    resultSection.appendChild(resultTitle); resultSection.appendChild(scoreText);
    resultSection.appendChild(percentageText); resultSection.appendChild(feedbackPara);
    buttonContainer.appendChild(tryAgainButton); // Añadir botones al contenedor
    buttonContainer.appendChild(restartButton);
    resultSection.appendChild(buttonContainer); // Añadir contenedor al DOM

    // Llamar a la función para obtener feedback IA SI HUBO ERRORES
    if (incorrectAnswers.length > 0) {
        // Asegurarse que la URL no es el placeholder
        if (analyzeResultsFunctionUrl.startsWith('PON_AQUI_LA_URL')) {
             console.error("Error de configuración: La URL de la función analyzeResults no ha sido configurada en script.js.");
             const feedbackElement = document.getElementById('aiFeedbackParagraph');
             if(feedbackElement) { feedbackElement.querySelector('em').textContent = "Error: No se puede contactar al servidor de análisis."; feedbackElement.style.color = 'red'; }
             return; // No continuar si la URL no está configurada
        }
        try {
            console.log("Llamando a la función analyze-results con:", incorrectAnswers);
            const feedbackResponse = await fetch(analyzeResultsFunctionUrl, { // <-- URL de GCF
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ incorrectAnswers: incorrectAnswers }), // Enviar los errores
            });
            const feedbackData = await feedbackResponse.json(); // Parsear JSON siempre
            console.log("Respuesta de analyze-results recibida:", feedbackData);

            if (!feedbackResponse.ok) {
                 const errorMessage = feedbackData?.error || `Error ${feedbackResponse.status} obteniendo feedback`;
                throw new Error(errorMessage);
            }

            console.log("Feedback generado por IA:", feedbackData.feedback);
            const feedbackElement = document.getElementById('aiFeedbackParagraph');
            if(feedbackElement) {
                 // Reemplazar el contenido de 'em' con el feedback recibido
                feedbackElement.querySelector('em').textContent = feedbackData.feedback;
            }

        } catch (error) {
            console.error("--- ERROR al obtener feedback de la IA ---");
            console.error(error);
            const feedbackElement = document.getElementById('aiFeedbackParagraph');
            if(feedbackElement) {
                feedbackElement.querySelector('em').textContent = `No se pudo generar el análisis de errores detallado: ${error.message}`;
                feedbackElement.style.color = 'darkorange'; // Indicar error suave
            }
        }
    }
}

// Función para resetear la UI en caso de error grave
function resetUIOnError() {
    loadingMessage.style.display = 'none';
    uploadSection.style.display = 'block';
    quizSection.style.display = 'none';
    resultSection.style.display = 'none';
    questionArea.style.display = 'none';
    documentUploadInput.value = ''; // Limpiar selección de archivo
}


// --- Fin del código ---
