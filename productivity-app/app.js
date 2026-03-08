class TaskManager {
    constructor() {
        // Cargar tareas guardadas localmente
        this.tasks = JSON.parse(localStorage.getItem('chronotasks')) || [];
        this.intervals = {}; // Objeto para guardar los cronómetros activos

        // Elementos de la UI
        this.taskInput = document.getElementById('task-input');
        this.addBtn = document.getElementById('add-task-btn');
        this.taskList = document.getElementById('task-list');

        this.init();
    }

    init() {
        // Escuchar clics y enter
        this.addBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Asegurarnos que los cronómetros de las tareas que estaban corriendo sigan
        this.tasks.forEach(task => {
            if (task.isRunning && !task.completed) {
                this.startTimerInterval(task.id);
            }
        });

        this.render();
    }

    save() {
        // Guarda en el caché local del navegador (persistencia)
        localStorage.setItem('chronotasks', JSON.stringify(this.tasks));
    }

    addTask() {
        const text = this.taskInput.value.trim();
        if (!text) return;

        const newTask = {
            id: 'task_' + Date.now().toString(),
            name: text,
            completed: false,
            timeElapsed: 0, // En segundos
            isRunning: false
        };

        this.tasks.unshift(newTask); // Agrega al principio
        this.taskInput.value = '';
        this.save();
        this.render();
    }

    toggleComplete(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            // Si la completamos y el timer estaba andando, lo pausamos
            if (task.completed && task.isRunning) {
                this.toggleTimer(id);
            }
            this.save();
            this.render();
        }
    }

    toggleTimer(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task || task.completed) return;

        if (task.isRunning) {
            // Detener timer actual
            clearInterval(this.intervals[id]);
            task.isRunning = false;
        } else {
            // (Opcional) Pausar cualquier otro cronómetro corriendo para enfocarse
            this.tasks.forEach(t => {
                if (t.id !== id && t.isRunning) {
                    clearInterval(this.intervals[t.id]);
                    t.isRunning = false;
                }
            });

            // Iniciar este timer
            task.isRunning = true;
            this.startTimerInterval(id);
        }

        this.save();
        this.render(); // Refresca la UI para los íconos
    }

    startTimerInterval(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        this.intervals[id] = setInterval(() => {
            task.timeElapsed++;
            this.updateTimerDisplay(id, task.timeElapsed);
            this.save(); // Guarda el progreso por cada tick 
        }, 1000);
    }

    deleteTask(id) {
        // Limpiamos memoria del cronómetro antes de borrar
        if (this.intervals[id]) {
            clearInterval(this.intervals[id]);
            delete this.intervals[id];
        }

        // Filtramos la tarea y guardamos
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.save();
        this.render();
    }

    // Helper p/ Formato 00:00:00
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    updateTimerDisplay(id, timeElapsed) {
        const timerEl = document.getElementById(`timer-${id}`);
        if (timerEl) {
            timerEl.textContent = this.formatTime(timeElapsed);
        }
    }

    render() {
        this.taskList.innerHTML = '';

        // Renderizamos estados vacíos si no hay tareas
        if (this.tasks.length === 0) {
            this.taskList.innerHTML = `
                <div style="text-align:center; color: var(--text-muted); opacity: 0.7; padding: 2rem;">
                    <i class="ri-meteor-line" style="font-size: 3rem; margin-bottom: 1rem; display:block;"></i>
                    <p>No tienes tareas pendientes.</p>
                    <p>¡Agrega una y comienza a rastrear tu productividad!</p>
                </div>
            `;
            return;
        }

        this.tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = `task-item ${task.completed ? 'completed' : ''}`;

            const iconPlayPause = task.isRunning ? 'ri-pause-circle-fill' : 'ri-play-circle-line';

            li.innerHTML = `
                <div class="task-info">
                    <div class="checkbox" onclick="app.toggleComplete('${task.id}')">
                        <i class="ri-check-line"></i>
                    </div>
                    <span class="task-name">${task.name}</span>
                </div>
                <div class="task-actions">
                    <span class="timer" id="timer-${task.id}">${this.formatTime(task.timeElapsed)}</span>
                    ${!task.completed ? `<button class="btn-icon btn-play ${task.isRunning ? 'active' : ''}" onclick="app.toggleTimer('${task.id}')" title="Play/Pause">
                        <i class="${iconPlayPause}"></i>
                    </button>` : ''}
                    <button class="btn-icon btn-delete" onclick="app.deleteTask('${task.id}')" title="Eliminar Tarea">
                        <i class="ri-delete-bin-line"></i>
                    </button>
                </div>
            `;

            this.taskList.appendChild(li);
        });
    }
}

// Iniciar App en el ámbito global para que los onclick inline funcionen
window.app = new TaskManager();
