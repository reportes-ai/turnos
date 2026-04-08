// ==================== STORAGE MODULE ====================
class Storage {
    static KEY = 'gesturnosAppState';
    
    static defaultState() {
        return {
            companies: [],
            workers: {},
            schedules: {},
            currentCompany: null
        };
    }
    
    static get() {
        const saved = localStorage.getItem(Storage.KEY);
        return saved ? JSON.parse(saved) : Storage.defaultState();
    }
    
    static save(state) {
        localStorage.setItem(Storage.KEY, JSON.stringify(state));
    }
    
    static clear() {
        localStorage.removeItem(Storage.KEY);
    }
    
    static export() {
        const state = Storage.get();
        const dataStr = JSON.stringify(state, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', `gesturnosApp_${new Date().toISOString().slice(0, 10)}.json`);
        link.click();
    }
    
    static import(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    Storage.save(data);
                    resolve(data);
                } catch (error) {
                    reject(new Error('Error al importar archivo'));
                }
            };
            reader.onerror = () => reject(new Error('Error al leer archivo'));
            reader.readAsText(file);
        });
    }
}

// ==================== COMPANIES ====================
class Company {
    static create(name, location, contact) {
        const state = Storage.get();
        const company = {
            id: Date.now(),
            name,
            location,
            contact,
            created: new Date().toLocaleDateString('es-CL')
        };
        
        state.companies.push(company);
        state.workers[company.id] = [];
        Storage.save(state);
        return company;
    }
    
    static getAll() {
        return Storage.get().companies;
    }
    
    static getById(id) {
        return Company.getAll().find(c => c.id === id);
    }
    
    static delete(id) {
        const state = Storage.get();
        state.companies = state.companies.filter(c => c.id !== id);
        delete state.workers[id];
        Storage.save(state);
    }
    
    static getWorkerCount(id) {
        const state = Storage.get();
        return (state.workers[id] || []).length;
    }
}

// ==================== WORKERS ====================
class Worker {
    static create(companyId, data) {
        const state = Storage.get();
        
        const worker = {
            id: Date.now(),
            companyId,
            rut: data.rut,
            name: data.name,
            position: data.position,
            salary: parseFloat(data.salary),
            jornada: data.jornada,
            days: data.days,
            preference: data.preference,
            timeOff: parseInt(data.timeOff) || 0,
            created: new Date().toLocaleDateString('es-CL')
        };
        
        if (!state.workers[companyId]) {
            state.workers[companyId] = [];
        }
        state.workers[companyId].push(worker);
        Storage.save(state);
        return worker;
    }
    
    static getByCompany(companyId) {
        const state = Storage.get();
        return state.workers[companyId] || [];
    }
    
    static getById(companyId, workerId) {
        return Worker.getByCompany(companyId).find(w => w.id === workerId);
    }
    
    static delete(companyId, workerId) {
        const state = Storage.get();
        if (state.workers[companyId]) {
            state.workers[companyId] = state.workers[companyId].filter(w => w.id !== workerId);
            Storage.save(state);
        }
    }
    
    static update(companyId, workerId, data) {
        const state = Storage.get();
        const worker = state.workers[companyId]?.find(w => w.id === workerId);
        if (worker) {
            Object.assign(worker, data);
            Storage.save(state);
        }
        return worker;
    }
    
    static getWorkingDaysInMonth(month, year) {
        // Calcula días hábiles en el mes (lunes a viernes)
        let workDays = 0;
        const date = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const day = new Date(year, month, d);
            const dayOfWeek = day.getDay();
            if (dayOfWeek > 0 && dayOfWeek < 6) workDays++;
        }
        return workDays;
    }
}

// ==================== CALCULATIONS ====================
class LegalCalculator {
    // IMM 2026 según normativa
    static IMM_2026 = {
        adults: 539000,  // Mayores de 18 y menores de 65
        minors: 402082   // Menores de 18 y mayores de 65
    };
    
    static calculateHourValue(salary, weekllyHours = 42) {
        // Valor hora ordinaria
        return salary / 30 / (weekllyHours / 5);
    }
    
    static calculateExtraHours(totalHours, ordinaryHoursInMonth) {
        return Math.max(0, totalHours - ordinaryHoursInMonth);
    }
    
    static calculateExtraHourPayment(extraHours, hourValue) {
        // Recargo mínimo 50%
        const extraHourValue = hourValue * 1.5;
        return extraHours * extraHourValue;
    }
    
    static calculateLegalBonus(salary) {
        // Art. 50: 25% del sueldo con tope de 4.75 IMM anuales
        const maxMonthlyBonus = (LegalCalculator.IMM_2026.adults * 4.75) / 12;
        return Math.min(salary * 0.25, maxMonthlyBonus);
    }
    
    static validateJornada(jornada) {
        // Validar que cumpla con Ley 40 Horas
        const validJornadas = [40, 42, 44];
        return validJornadas.includes(parseInt(jornada));
    }
    
    static getMaxExtraHoursDaily() {
        return 2; // Máximo 2 horas diarias
    }
    
    static getMaxExtraHoursWeekly() {
        return 12; // Máximo 12 horas semanales
    }
    
    static getMaxWeeklyHours() {
        return 52; // Suma ordinarias + extras no puede exceder 52
    }
    
    static getMinDailyRest() {
        return 12; // Mínimo 12 horas entre jornadas
    }
    
    static getMinColation() {
        return 30; // Mínimo 30 minutos
    }
    
    static validateCompliance(worker, monthlyHours) {
        const jornada = parseInt(worker.jornada);
        const ordinaryMonthlyHours = jornada * 4.33; // 4.33 semanas promedio
        const extraHours = this.calculateExtraHours(monthlyHours, ordinaryMonthlyHours);
        
        const issues = [];
        
        // Validar horas ordinarias
        if (monthlyHours < ordinaryMonthlyHours) {
            issues.push({
                type: 'warning',
                message: `Horas por debajo de lo contratado: ${monthlyHours.toFixed(1)} vs ${ordinaryMonthlyHours.toFixed(1)}`
            });
        }
        
        // Validar horas extras
        if (extraHours > 0) {
            const weeklyExtra = extraHours / 4.33;
            if (weeklyExtra > this.getMaxExtraHoursWeekly()) {
                issues.push({
                    type: 'error',
                    message: `Excede límite semanal de extras: ${weeklyExtra.toFixed(1)}h vs ${this.getMaxExtraHoursWeekly()}h`
                });
            }
        }
        
        return {
            valid: issues.filter(i => i.type === 'error').length === 0,
            issues
        };
    }
}

// ==================== SCHEDULE ====================
class Schedule {
    static SHIFTS = {
        mañana: { start: '08:00', end: '15:15', colation: 30, worked: 6.75 },
        tarde: { start: '15:00', end: '22:15', colation: 30, worked: 6.75 },
        noche: { start: '22:00', end: '08:15', colation: 30, worked: 9.75 }
    };
    
    static generateForMonth(companyId, month, year) {
        const workers = Worker.getByCompany(companyId);
        if (workers.length === 0) {
            throw new Error('No hay trabajadores en esta empresa');
        }
        
        const schedule = {};
        const workingDays = Worker.getWorkingDaysInMonth(month - 1, year);
        
        workers.forEach((worker, index) => {
            schedule[worker.id] = {
                worker,
                days: {},
                totalHours: 0,
                extraHours: 0
            };
            
            // Distribuir turnos
            const shiftNames = Object.keys(Schedule.SHIFTS);
            let shiftIndex = index % shiftNames.length;
            let assignedDays = 0;
            const daysPerWeek = parseInt(worker.days);
            
            for (let day = 1; day <= new Date(year, month, 0).getDate(); day++) {
                const date = new Date(year, month - 1, day);
                const dayOfWeek = date.getDay();
                
                // Asignar turno respetando preferencia
                if (dayOfWeek > 0 && dayOfWeek < 6 && assignedDays < daysPerWeek * 4) {
                    const shiftName = shiftNames[shiftIndex];
                    const shift = Schedule.SHIFTS[shiftName];
                    
                    schedule[worker.id].days[day] = {
                        shift: shiftName,
                        ...shift
                    };
                    
                    schedule[worker.id].totalHours += shift.worked;
                    assignedDays++;
                    shiftIndex = (shiftIndex + 1) % shiftNames.length;
                }
            }
            
            // Calcular horas extras
            const jornada = parseInt(worker.jornada);
            const ordinaryHours = jornada * 4.33;
            schedule[worker.id].extraHours = Math.max(0, schedule[worker.id].totalHours - ordinaryHours);
        });
        
        return schedule;
    }
    
    static save(companyId, month, schedule) {
        const state = Storage.get();
        const key = `${companyId}_${month}`;
        state.schedules[key] = schedule;
        Storage.save(state);
    }
    
    static get(companyId, month) {
        const state = Storage.get();
        const key = `${companyId}_${month}`;
        return state.schedules[key];
    }
}
