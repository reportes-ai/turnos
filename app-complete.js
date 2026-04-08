// ==================== SCHEDULER ADVANCED ====================
class SchedulerAdvanced {
    static SHIFTS = {
        mañana: { start: '08:00', end: '15:15', hours: 6.75, color: '#FDB833' },
        tarde: { start: '15:00', end: '22:15', hours: 6.75, color: '#4ECDC4' },
        noche: { start: '22:00', end: '08:15', hours: 9.75, color: '#7B68EE' }
    };
    
    static optimize(workers, coverageStart, coverageEnd, availableShifts, month, year) {
        if (workers.length === 0) throw new Error('No hay trabajadores');
        if (availableShifts.length === 0) throw new Error('No hay turnos seleccionados');
        
        const daysInMonth = new Date(year, month, 0).getDate();
        const schedule = {};
        const analysisData = {
            assignments: {},
            dailyCoverage: {},
            recommendations: [],
            violations: [],
            costAnalysis: {}
        };
        
        workers.forEach(w => {
            schedule[w.id] = {
                worker: w,
                assignments: {},
                totalHours: 0,
                extraHours: 0,
                totalCost: 0,
                extraCost: 0,
                shifts: []
            };
        });
        
        for (let day = 1; day <= daysInMonth; day++) {
            analysisData.dailyCoverage[day] = {
                mañana: [],
                tarde: [],
                noche: [],
                gapsDetected: []
            };
        }
        
        this.assignShiftsOptimally(workers, schedule, daysInMonth, availableShifts, analysisData, month, year);
        this.calculateCosts(schedule, workers);
        this.analyzeCompliance(schedule, analysisData);
        this.generateRecommendations(schedule, analysisData, workers);
        
        return {
            schedule,
            analysis: analysisData,
            summary: this.generateSummary(schedule, workers, month, year)
        };
    }
    
    static assignShiftsOptimally(workers, schedule, daysInMonth, availableShifts, analysis, month, year) {
        const workersData = workers.map(w => ({
            id: w.id,
            name: w.name,
            salary: w.salary,
            jornada: parseInt(w.jornada),
            days: parseInt(w.days),
            preference: w.preference,
            assigned: 0,
            hoursAssigned: 0,
            shiftRotation: 0
        }));
        
        const targetWeeklyHours = 42;
        const targetMonthlyHours = targetWeeklyHours * 4.33;
        const workDaysInMonth = this.getWorkingDays(month, year);
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            
            if (dayOfWeek === 0) continue;
            
            for (const shiftName of availableShifts) {
                const shift = this.SHIFTS[shiftName];
                
                const bestWorker = this.selectBestWorkerForShift(workersData, shiftName, day, targetMonthlyHours);
                
                if (bestWorker) {
                    if (!schedule[bestWorker.id].assignments[day]) {
                        schedule[bestWorker.id].assignments[day] = [];
                    }
                    
                    schedule[bestWorker.id].assignments[day].push({
                        shift: shiftName,
                        start: shift.start,
                        end: shift.end,
                        hours: shift.hours,
                        date: day
                    });
                    
                    schedule[bestWorker.id].totalHours += shift.hours;
                    bestWorker.hoursAssigned += shift.hours;
                    bestWorker.assigned++;
                    
                    analysis.dailyCoverage[day][shiftName].push(bestWorker.name);
                }
            }
        }
        
        this.balanceAssignments(workersData, schedule, daysInMonth, availableShifts);
    }
    
    static selectBestWorkerForShift(workers, shiftName, day, targetHours) {
        const candidates = workers
            .filter(w => w.hoursAssigned < targetHours)
            .sort((a, b) => {
                const prefMatch = (w) => w.preference === shiftName ? 2 : 0;
                const hoursScore = (targetHours - w.hoursAssigned) / targetHours;
                
                return (prefMatch(b) + hoursScore * 10) - (prefMatch(a) + hoursScore * 10);
            });
        
        return candidates[0] || null;
    }
    
    static balanceAssignments(workers, schedule, daysInMonth, availableShifts) {
        const avgHours = workers.reduce((sum, w) => sum + w.hoursAssigned, 0) / workers.length;
        
        workers.forEach(w => {
            if (w.hoursAssigned < avgHours * 0.8) {
                for (const shiftName of availableShifts) {
                    if (w.hoursAssigned >= avgHours) break;
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                        if (!schedule[w.id].assignments[day]) {
                            schedule[w.id].assignments[day] = [];
                        }
                        
                        const shift = this.SHIFTS[shiftName];
                        schedule[w.id].assignments[day].push({
                            shift: shiftName,
                            start: shift.start,
                            end: shift.end,
                            hours: shift.hours,
                            date: day
                        });
                        
                        schedule[w.id].totalHours += shift.hours;
                        w.hoursAssigned += shift.hours;
                        break;
                    }
                }
            }
        });
    }
    
    static calculateCosts(schedule, workers) {
        workers.forEach(w => {
            const jornada = parseInt(w.jornada);
            const ordinaryHours = jornada * 4.33;
            
            schedule[w.id].extraHours = Math.max(0, schedule[w.id].totalHours - ordinaryHours);
            
            const hourValue = w.salary / 30 / (jornada / 5);
            schedule[w.id].totalCost = w.salary;
            schedule[w.id].extraCost = schedule[w.id].extraHours * (hourValue * 1.5);
        });
    }
    
    static analyzeCompliance(schedule, analysis) {
        Object.values(schedule).forEach(s => {
            const extraHours = s.extraHours;
            const weeklyExtra = extraHours / 4.33;
            
            if (weeklyExtra > 12) {
                analysis.violations.push({
                    worker: s.worker.name,
                    violation: `Horas extras semanales: ${weeklyExtra.toFixed(1)}h > 12h límite`,
                    severity: 'error'
                });
            }
            
            const totalWeekly = s.totalHours / 4.33;
            if (totalWeekly > 52) {
                analysis.violations.push({
                    worker: s.worker.name,
                    violation: `Total semanal: ${totalWeekly.toFixed(1)}h > 52h límite`,
                    severity: 'error'
                });
            }
        });
    }
    
    static generateRecommendations(schedule, analysis, workers) {
        let totalExtras = 0;
        let workersWithExtras = 0;
        
        Object.values(schedule).forEach(s => {
            if (s.extraHours > 0) {
                totalExtras += s.extraHours;
                workersWithExtras++;
            }
        });
        
        if (workersWithExtras > workers.length * 0.5) {
            const avgSalary = workers.reduce((sum, w) => sum + w.salary, 0) / workers.length;
            const extraCost = Object.values(schedule).reduce((sum, s) => sum + s.extraCost, 0);
            const newPersonnelCost = avgSalary;
            
            if (newPersonnelCost < extraCost * 1.2) {
                analysis.recommendations.push({
                    type: 'hiring',
                    title: 'Contratar Personal Adicional',
                    description: `Costo actual de extras: $${extraCost.toLocaleString('es-CL')}`,
                    benefit: `Costo nuevo empleado: $${newPersonnelCost.toLocaleString('es-CL')} + mejor cobertura`,
                    savings: (extraCost - newPersonnelCost).toFixed(0)
                });
            }
        }
        
        analysis.recommendations.push({
            type: 'schedule',
            title: 'Distribución de Turnos Optimizada',
            description: `${workersWithExtras} trabajadores con horas extras`,
            benefit: 'Rotación equitativa minimiza fatiga',
            details: `Total extras: ${totalExtras.toFixed(1)}h`
        });
    }
    
    static generateSummary(schedule, workers, month, year) {
        const months = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const totalHours = Object.values(schedule).reduce((sum, s) => sum + s.totalHours, 0);
        const totalExtras = Object.values(schedule).reduce((sum, s) => sum + s.extraHours, 0);
        const totalCosts = Object.values(schedule).reduce((sum, s) => sum + s.totalCost + s.extraCost, 0);
        const avgHoursPerWorker = totalHours / workers.length;
        
        return {
            period: `${months[month]} ${year}`,
            totalWorkers: workers.length,
            totalHours,
            totalExtras,
            totalCosts,
            avgHoursPerWorker: avgHoursPerWorker.toFixed(1),
            workersWithExtras: Object.values(schedule).filter(s => s.extraHours > 0).length
        };
    }
    
    static getWorkingDays(month, year) {
        let workDays = 0;
        const lastDay = new Date(year, month, 0);
        
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const day = new Date(year, month - 1, d);
            const dayOfWeek = day.getDay();
            if (dayOfWeek > 0 && dayOfWeek < 6) workDays++;
        }
        return workDays;
    }
}

class ReportGeneratorAdvanced {
    static generateDetailedSchedule(schedule, company, month, year) {
        const months = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        let html = `
            <style>
                body { font-family: Arial; margin: 20px; background: #f5f5f5; }
                .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #1a3a52; padding-bottom: 15px; }
                .company { font-size: 24px; font-weight: bold; color: #1a3a52; }
                .month { font-size: 14px; color: #666; margin-top: 5px; }
                .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
                .summary-card { background: white; padding: 15px; border-left: 4px solid #d4a574; }
                .summary-value { font-size: 24px; font-weight: bold; color: #1a3a52; }
                .summary-label { font-size: 12px; color: #999; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                th { background: #1a3a52; color: white; padding: 12px; text-align: left; font-weight: bold; font-size: 12px; }
                td { padding: 10px; border-bottom: 1px solid #eee; }
                tr:hover { background: #f9f9f9; }
            </style>
            
            <div class="header">
                <div class="company">${company.name || 'Empresa'}</div>
                <div class="month">Programación de Turnos - ${months[month]} ${year}</div>
            </div>
            
            <div class="summary">
                <div class="summary-card">
                    <div class="summary-value">${Object.keys(schedule).length}</div>
                    <div class="summary-label">Trabajadores</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${Object.values(schedule).reduce((sum, s) => sum + s.totalHours, 0).toFixed(0)}</div>
                    <div class="summary-label">Horas Totales</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${Object.values(schedule).reduce((sum, s) => sum + s.extraHours, 0).toFixed(1)}</div>
                    <div class="summary-label">Horas Extras</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">$${Object.values(schedule).reduce((sum, s) => sum + s.extraCost, 0).toLocaleString('es-CL')}</div>
                    <div class="summary-label">Costo Extras</div>
                </div>
            </div>
            
            <h2>Detalles por Trabajador</h2>
            <table>
                <thead>
                    <tr>
                        <th>Trabajador</th>
                        <th>RUT</th>
                        <th>Cargo</th>
                        <th>Horas Ordinarias</th>
                        <th>Horas Extras</th>
                        <th>Total Horas</th>
                        <th>Costo Extras</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        Object.values(schedule).forEach(s => {
            const jornada = parseInt(s.worker.jornada);
            const ordinaryHours = jornada * 4.33;
            
            html += `
                <tr>
                    <td><strong>${s.worker.name}</strong></td>
                    <td>${s.worker.rut}</td>
                    <td>${s.worker.position}</td>
                    <td>${ordinaryHours.toFixed(1)}</td>
                    <td>${s.extraHours.toFixed(1)}</td>
                    <td><strong>${s.totalHours.toFixed(1)}</strong></td>
                    <td>$${s.extraCost.toLocaleString('es-CL')}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        return html;
    }
}

// ==================== MAIN APP CONTROLLER ====================
class App {
    static state = Storage.get();
    
    static init() {
        this.state = Storage.get();
        this.refreshUI();
        this.setupEventListeners();
        document.getElementById('monthDisplay').textContent = 
            new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    }
    
    static setupEventListeners() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    App.closeModal(modal.id);
                }
            });
        });
    }
    
    static showPanel(panelName) {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.getElementById(panelName + '-panel').classList.add('active');
        
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        event.target?.classList.add('active');
        
        const titles = {
            'empresas': 'Administración de Empresas',
            'personal': 'Gestión de Personal',
            'turnos': 'Optimizador de Turnos',
            'reportes': 'Reportes y Documentos',
            'calculos': 'Calculadora de Remuneraciones',
            'normativa': 'Normativa Ley 40 Horas 2026'
        };
        document.getElementById('pageTitle').textContent = titles[panelName] || panelName;
        
        this.loadPanelData(panelName);
    }
    
    static loadPanelData(panelName) {
        if (panelName === 'empresas') {
            this.renderCompanies();
        } else if (panelName === 'personal') {
            this.loadPersonalPanel();
        } else if (panelName === 'turnos') {
            this.loadSchedulePanel();
        }
    }
    
    static renderCompanies() {
        const tbody = document.getElementById('companiesList');
        const companies = Company.getAll();
        
        if (companies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-dim);">No hay empresas registradas. Crea una para comenzar.</td></tr>';
            return;
        }
        
        tbody.innerHTML = companies.map(company => `
            <tr>
                <td><strong>${company.name}</strong></td>
                <td>${company.location || '-'}</td>
                <td>${Company.getWorkerCount(company.id)}</td>
                <td>${company.created}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-small" onclick="App.selectCompany(${company.id})">Abrir</button>
                        <button class="btn btn-danger btn-small" onclick="App.deleteCompany(${company.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    static addCompany(event) {
        event.preventDefault();
        
        const name = document.getElementById('companyName').value;
        const location = document.getElementById('companyLocation').value;
        const contact = document.getElementById('companyContact').value;
        
        if (!name) {
            alert('El nombre de empresa es requerido');
            return;
        }
        
        Company.create(name, location, contact);
        this.state = Storage.get();
        
        this.closeModal('newCompanyModal');
        document.getElementById('newCompanyModal').querySelector('form').reset();
        this.renderCompanies();
    }
    
    static selectCompany(companyId) {
        this.state = Storage.get();
        this.state.currentCompany = companyId;
        Storage.save(this.state);
        this.showPanel('personal');
    }
    
    static deleteCompany(companyId) {
        if (confirm('⚠️ ¿Eliminar empresa? Se perderán TODOS los datos del personal y turnos.')) {
            Company.delete(companyId);
            this.state = Storage.get();
            this.renderCompanies();
        }
    }
    
    static loadPersonalPanel() {
        const select = document.getElementById('selectCompany');
        const companies = Company.getAll();
        
        select.innerHTML = '<option value="">-- Selecciona empresa --</option>' +
            companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        if (this.state.currentCompany) {
            select.value = this.state.currentCompany;
            this.loadWorkers();
        }
    }
    
    static openNewWorkerModal() {
        const companyId = document.getElementById('selectCompany').value;
        
        if (!companyId) {
            alert('⚠️ Primero selecciona una empresa en el dropdown');
            return;
        }
        
        document.getElementById('newWorkerModal').dataset.workerId = '';
        document.getElementById('newWorkerModal').dataset.companyId = '';
        document.querySelector('#newWorkerModal .modal-header span').textContent = 'Nuevo Trabajador';
        document.querySelector('#newWorkerModal .btn-primary').textContent = 'Agregar Trabajador';
        document.getElementById('newWorkerModal').querySelector('form').reset();
        
        this.showModal('newWorkerModal');
    }
    
    static editWorker(companyId, workerId) {
        const worker = Worker.getById(companyId, workerId);
        
        if (!worker) {
            alert('Trabajador no encontrado');
            return;
        }
        
        document.getElementById('workerRut').value = worker.rut;
        document.getElementById('workerName').value = worker.name;
        document.getElementById('workerPosition').value = worker.position;
        document.getElementById('workerSalary').value = worker.salary;
        document.getElementById('workerJornada').value = worker.jornada;
        document.getElementById('workerDays').value = worker.days;
        document.getElementById('workerPreference').value = worker.preference;
        document.getElementById('workerTimeOff').value = worker.timeOff;
        
        document.querySelector('#newWorkerModal .modal-header span').textContent = 'Editar Trabajador';
        document.querySelector('#newWorkerModal .btn-primary').textContent = 'Guardar Cambios';
        
        document.getElementById('newWorkerModal').dataset.workerId = workerId;
        document.getElementById('newWorkerModal').dataset.companyId = companyId;
        
        this.showModal('newWorkerModal');
    }
    
    static loadWorkers() {
        const companyId = parseInt(document.getElementById('selectCompany').value);
        
        if (!companyId) {
            document.getElementById('workersList').innerHTML = 
                '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">Selecciona una empresa</td></tr>';
            return;
        }
        
        this.state.currentCompany = companyId;
        Storage.save(this.state);
        
        const workers = Worker.getByCompany(companyId);
        const tbody = document.getElementById('workersList');
        
        if (workers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-dim);">No hay trabajadores. Haz clic en "+ Nuevo Trabajador"</td></tr>';
            return;
        }
        
        tbody.innerHTML = workers.map(worker => `
            <tr>
                <td>${worker.rut}</td>
                <td><strong>${worker.name}</strong></td>
                <td>${worker.position}</td>
                <td>$${worker.salary.toLocaleString('es-CL')}</td>
                <td>${worker.jornada} hrs</td>
                <td>${worker.days} días</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-secondary btn-small" onclick="App.editWorker(${companyId}, ${worker.id})">Editar</button>
                        <button class="btn btn-danger btn-small" onclick="App.deleteWorker(${companyId}, ${worker.id})">Eliminar</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    static addWorker(event) {
        event.preventDefault();
        
        const companyId = parseInt(document.getElementById('selectCompany').value);
        const modal = document.getElementById('newWorkerModal');
        const isEditing = modal.dataset.workerId;
        
        if (!companyId && !isEditing) {
            alert('⚠️ Selecciona una empresa primero');
            return;
        }
        
        const workerData = {
            rut: document.getElementById('workerRut').value,
            name: document.getElementById('workerName').value,
            position: document.getElementById('workerPosition').value,
            salary: document.getElementById('workerSalary').value,
            jornada: document.getElementById('workerJornada').value,
            days: document.getElementById('workerDays').value,
            preference: document.getElementById('workerPreference').value,
            timeOff: document.getElementById('workerTimeOff').value
        };
        
        if (!workerData.rut || !workerData.name || !workerData.position || 
            !workerData.salary || !workerData.jornada || !workerData.days) {
            alert('Completa todos los campos requeridos');
            return;
        }
        
        if (!LegalCalculator.validateJornada(workerData.jornada)) {
            alert('Jornada inválida. Debe ser 40, 42 o 44 horas');
            return;
        }
        
        if (isEditing) {
            const workerId = parseInt(modal.dataset.workerId);
            const editCompanyId = parseInt(modal.dataset.companyId);
            Worker.update(editCompanyId, workerId, workerData);
            
            delete modal.dataset.workerId;
            delete modal.dataset.companyId;
            document.querySelector('#newWorkerModal .modal-header span').textContent = 'Nuevo Trabajador';
            document.querySelector('#newWorkerModal .btn-primary').textContent = 'Agregar Trabajador';
        } else {
            Worker.create(companyId, workerData);
        }
        
        this.state = Storage.get();
        this.closeModal('newWorkerModal');
        document.getElementById('newWorkerModal').querySelector('form').reset();
        this.loadWorkers();
    }
    
    static deleteWorker(companyId, workerId) {
        if (confirm('¿Eliminar trabajador?')) {
            Worker.delete(companyId, workerId);
            this.state = Storage.get();
            this.loadWorkers();
        }
    }
    
    static loadSchedulePanel() {
        const select = document.getElementById('turnosCompany');
        const companies = Company.getAll();
        
        select.innerHTML = '<option value="">Selecciona empresa</option>' +
            companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        document.getElementById('turnosMonth').valueAsDate = nextMonth;
        
        document.getElementById('scheduleConfig').style.display = 'none';
        document.getElementById('scheduleResult').style.display = 'none';
    }
    
    static loadScheduleConfig() {
        const companyId = parseInt(document.getElementById('turnosCompany').value);
        
        if (!companyId) {
            document.getElementById('scheduleConfig').style.display = 'none';
            return;
        }
        
        const workers = Worker.getByCompany(companyId);
        if (workers.length === 0) {
            alert('No hay trabajadores en esta empresa');
            return;
        }
        
        document.getElementById('scheduleConfig').style.display = 'block';
        
        const shiftsConfig = document.getElementById('shiftsConfig');
        shiftsConfig.innerHTML = `
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <input type="checkbox" class="shift-option" value="mañana" checked style="width: 18px; height: 18px; cursor: pointer;"> 
                <span>Mañana (08:00 - 15:15, 6:45h)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <input type="checkbox" class="shift-option" value="tarde" checked style="width: 18px; height: 18px; cursor: pointer;"> 
                <span>Tarde (15:00 - 22:15, 6:45h)</span>
            </label>
            <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <input type="checkbox" class="shift-option" value="noche" checked style="width: 18px; height: 18px; cursor: pointer;"> 
                <span>Noche (22:00 - 08:15, 9:45h)</span>
            </label>
        `;
    }
    
    static generateOptimalSchedule() {
        const companyId = parseInt(document.getElementById('turnosCompany').value);
        const monthStr = document.getElementById('turnosMonth').value;
        const coverageStart = document.getElementById('coverageStart').value;
        const coverageEnd = document.getElementById('coverageEnd').value;
        
        if (!companyId || !monthStr) {
            alert('Selecciona empresa y mes');
            return;
        }
        
        const [year, month] = monthStr.split('-').map(Number);
        const workers = Worker.getByCompany(companyId);
        const company = Company.getById(companyId);
        
        if (workers.length === 0) {
            alert('No hay trabajadores para generar turnos');
            return;
        }
        
        const selectedShifts = Array.from(document.querySelectorAll('.shift-option:checked'))
            .map(el => el.value);
        
        if (selectedShifts.length === 0) {
            alert('Selecciona al menos un tipo de turno');
            return;
        }
        
        try {
            const result = SchedulerAdvanced.optimize(workers, coverageStart, coverageEnd, selectedShifts, month, year);
            this.displayAdvancedScheduleResult(result, companyId, monthStr, company);
        } catch (error) {
            alert('Error al generar turnos: ' + error.message);
        }
    }
    
    static displayAdvancedScheduleResult(result, companyId, monthStr, company) {
        const { schedule, analysis, summary } = result;
        
        let html = `<div class="alert alert-success">✓ Turnos optimizados para ${monthStr}</div>`;
        
        html += `
            <div style="margin-top: 24px;">
                <h3 style="color: var(--secondary); margin-bottom: 16px;">📊 Resumen Ejecutivo</h3>
                
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div class="card">
                        <div class="stat-value">${summary.totalWorkers}</div>
                        <div class="stat-label">Trabajadores</div>
                    </div>
                    <div class="card">
                        <div class="stat-value">${summary.totalHours.toFixed(0)}</div>
                        <div class="stat-label">Horas Totales</div>
                    </div>
                    <div class="card">
                        <div class="stat-value">${summary.totalExtras.toFixed(1)}</div>
                        <div class="stat-label">Horas Extras</div>
                    </div>
                    <div class="card">
                        <div class="stat-value">$${summary.totalCosts.toLocaleString('es-CL')}</div>
                        <div class="stat-label">Costo Total</div>
                    </div>
                </div>
        `;
        
        html += `
            <h3 style="color: var(--secondary); margin-bottom: 16px;">👥 Detalles por Trabajador</h3>
            
            <div class="table-wrapper">
                <table style="width: 100%; font-size: 12px;">
                    <thead>
                        <tr style="background: #1a3a52;">
                            <th style="padding: 10px; color: #d4a574; text-align: left;">Trabajador</th>
                            <th style="padding: 10px; color: #d4a574; text-align: center;">Horas Ordinarias</th>
                            <th style="padding: 10px; color: #d4a574; text-align: center;">Horas Extras</th>
                            <th style="padding: 10px; color: #d4a574; text-align: center;">Total Horas</th>
                            <th style="padding: 10px; color: #d4a574; text-align: center;">Costo Extras</th>
                            <th style="padding: 10px; color: #d4a574; text-align: center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        Object.values(schedule).forEach(s => {
            const jornada = parseInt(s.worker.jornada);
            const ordinaryHours = jornada * 4.33;
            const extraCost = s.extraCost;
            const status = s.extraHours > 0 ? '⚠️ Extras' : '✓ Cumple';
            
            html += `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 10px;"><strong>${s.worker.name}</strong></td>
                    <td style="padding: 10px; text-align: center;">${ordinaryHours.toFixed(1)}</td>
                    <td style="padding: 10px; text-align: center; color: ${s.extraHours > 0 ? '#e74c3c' : '#27ae60'};">${s.extraHours.toFixed(1)}</td>
                    <td style="padding: 10px; text-align: center;"><strong>${s.totalHours.toFixed(1)}</strong></td>
                    <td style="padding: 10px; text-align: center;">$${extraCost.toLocaleString('es-CL')}</td>
                    <td style="padding: 10px; text-align: center;">${status}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        if (analysis.violations.length > 0) {
            html += `
                <div class="alert alert-warning" style="margin-top: 24px;">
                    ⚠️ <strong>${analysis.violations.length} problemas detectados:</strong>
                    <ul style="margin: 8px 0 0 20px;">
            `;
            analysis.violations.forEach(v => {
                html += `<li style="margin: 4px 0;">${v.worker}: ${v.violation}</li>`;
            });
            html += `</ul></div>`;
        }
        
        if (analysis.recommendations.length > 0) {
            html += `
                <h3 style="color: var(--secondary); margin-top: 24px; margin-bottom: 16px;">💡 Recomendaciones</h3>
            `;
            analysis.recommendations.forEach(rec => {
                html += `
                    <div style="padding: 16px; background: var(--primary); border-radius: 4px; margin-bottom: 12px; border-left: 4px solid var(--secondary);">
                        <strong>${rec.title}</strong>
                        <p style="margin-top: 8px; color: var(--text-dim); font-size: 13px;">${rec.description}</p>
                        ${rec.benefit ? `<p style="color: var(--success); margin-top: 8px;"><strong>✓ ${rec.benefit}</strong></p>` : ''}
                    </div>
                `;
            });
        }
        
        html += `
            <div style="margin-top: 24px; display: flex; gap: 12px;">
                <button class="btn btn-success" onclick="App.saveAndPrintSchedule('${companyId}', '${monthStr}', '${company.name}')">📄 Ver Reporte Completo</button>
                <button class="btn btn-secondary" onclick="window.print()">🖨️ Imprimir</button>
            </div>
        </div>
        `;
        
        document.getElementById('scheduleResult').innerHTML = html;
        document.getElementById('scheduleResult').style.display = 'block';
        
        window.lastScheduleResult = { schedule, analysis, summary, company, monthStr };
    }
    
    static saveAndPrintSchedule(companyId, monthStr, companyName) {
        const result = window.lastScheduleResult;
        if (!result) {
            alert('Genera turnos primero');
            return;
        }
        
        const reportHTML = ReportGeneratorAdvanced.generateDetailedSchedule(
            result.schedule,
            { name: companyName },
            parseInt(monthStr.split('-')[1]),
            parseInt(monthStr.split('-')[0])
        );
        
        const printWindow = window.open('', '', 'width=1200,height=800');
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.print();
    }
    
    static calculateLegal() {
        const rut = document.getElementById('calcRut').value;
        const salary = parseFloat(document.getElementById('calcSalary').value);
        const hours = parseFloat(document.getElementById('calcHours').value);
        const jornada = parseInt(document.getElementById('calcJornadaType').value);
        
        if (!rut || !salary || !hours) {
            alert('Completa todos los campos');
            return;
        }
        
        const ordinaryMonthly = jornada * 4.33;
        const extraHours = Math.max(0, hours - ordinaryMonthly);
        
        const hourValue = LegalCalculator.calculateHourValue(salary, jornada);
        const extraPayment = LegalCalculator.calculateExtraHourPayment(extraHours, hourValue);
        const bonus = LegalCalculator.calculateLegalBonus(salary);
        
        const worker = { jornada, salary };
        const compliance = LegalCalculator.validateCompliance(worker, hours);
        
        let html = `
            <div class="alert alert-info">Cálculo Legal según Ley 21.561</div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px;">
                <div class="card">
                    <div class="stat-value">$${salary.toLocaleString('es-CL')}</div>
                    <div class="stat-label">Sueldo Base</div>
                </div>
                <div class="card">
                    <div class="stat-value">$${extraPayment.toLocaleString('es-CL')}</div>
                    <div class="stat-label">Extras (${extraHours.toFixed(1)}h)</div>
                </div>
                <div class="card">
                    <div class="stat-value">$${bonus.toLocaleString('es-CL')}</div>
                    <div class="stat-label">Gratificación</div>
                </div>
            </div>
            
            <div style="margin-top: 24px; padding: 16px; background: var(--primary); border-radius: 4px; border: 2px solid var(--secondary);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-size: 16px;">Total Devengado</span>
                    <strong style="color: var(--secondary); font-size: 24px;">$${(salary + extraPayment + bonus).toLocaleString('es-CL')}</strong>
                </div>
            </div>
            
            <div style="margin-top: 16px;">
                ${compliance.valid ? 
                    '<div class="alert alert-success">✓ Cumple con normativa legal</div>' : 
                    '<div class="alert alert-danger">✗ Detectados problemas de cumplimiento</div>'
                }
            </div>
        `;
        
        document.getElementById('calcResult').innerHTML = html;
    }
    
    static generateReport(type) {
        alert('Reporte: ' + type);
    }
    
    static showModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }
    
    static closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }
    
    static refreshUI() {
        const now = new Date();
        document.getElementById('monthDisplay').textContent = 
            now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    }
    
    static exportData() {
        try {
            Storage.export();
            alert('✓ Datos exportados correctamente');
        } catch (error) {
            alert('Error al exportar: ' + error.message);
        }
    }
    
    static importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                const imported = await Storage.import(file);
                this.state = imported;
                this.refreshUI();
                this.renderCompanies();
                alert('✓ Datos importados correctamente');
            } catch (error) {
                alert('Error al importar: ' + error.message);
            }
        };
        
        input.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
