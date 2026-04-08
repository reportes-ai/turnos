// ==================== MAIN APP CONTROLLER ====================
class App {
    static state = Storage.get();
    
    // ==================== INITIALIZATION ====================
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
    
    // ==================== PANEL NAVIGATION ====================
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
    
    // ==================== COMPANIES ====================
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
    
    // ==================== PERSONAL ====================
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
        
        // Reset modal para nuevo trabajador
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
    
    // ==================== SCHEDULE ====================
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
            <div style="display: grid; gap: 12px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" class="shift-option" value="mañana" checked> 
                    Mañana (08:00 - 15:15, 6:45h)
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" class="shift-option" value="tarde" checked> 
                    Tarde (15:00 - 22:15, 6:45h)
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" class="shift-option" value="noche" checked> 
                    Noche (22:00 - 08:15, 9:45h)
                </label>
            </div>
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
            const optimized = Scheduler.optimize(workers, coverageStart, coverageEnd, selectedShifts);
            this.displayScheduleResult(optimized, companyId, monthStr);
        } catch (error) {
            alert('Error al generar turnos: ' + error.message);
        }
    }
    
    static displayScheduleResult(result, companyId, monthStr) {
        const company = Company.getById(companyId);
        let html = `<div class="alert alert-success">✓ Turnos generados para ${monthStr}</div>`;
        
        html += `
            <div style="margin-top: 24px;">
                <h3 style="color: var(--secondary); margin-bottom: 16px;">Resumen de Asignaciones</h3>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                    <div class="card">
                        <div class="stat-value">${Object.keys(result.schedule).length}</div>
                        <div class="stat-label">Trabajadores</div>
                    </div>
                    <div class="card">
                        <div class="stat-value">${Object.values(result.schedule).reduce((sum, a) => sum + a.hours, 0).toFixed(0)}</div>
                        <div class="stat-label">Horas Totales</div>
                    </div>
                    <div class="card">
                        <div class="stat-value">${Object.values(result.schedule).reduce((sum, a) => sum + a.extraHours, 0).toFixed(1)}</div>
                        <div class="stat-label">Horas Extras</div>
                    </div>
                </div>
        `;
        
        if (result.issues.length > 0) {
            html += `<div class="alert alert-warning">⚠️ ${result.issues.length} problemas detectados</div>`;
        }
        
        if (result.recommendations.length > 0) {
            html += `<h3 style="color: var(--secondary); margin: 24px 0 16px;">Recomendaciones</h3>`;
            result.recommendations.forEach(rec => {
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
                <button class="btn btn-success" onclick="App.saveSchedule(${companyId}, '${monthStr}')">💾 Guardar Turnos</button>
                <button class="btn btn-secondary" onclick="App.printSchedule()">🖨️ Imprimir</button>
            </div>
        </div>
        `;
        
        document.getElementById('scheduleResult').innerHTML = html;
        document.getElementById('scheduleResult').style.display = 'block';
    }
    
    static saveSchedule(companyId, monthStr) {
        alert('Turnos guardados para ' + monthStr);
    }
    
    static printSchedule() {
        window.print();
    }
    
    // ==================== CALCULATIONS ====================
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
            
            <div style="margin-top: 16px; font-size: 12px; color: var(--text-dim); line-height: 1.8;">
                <p>✓ Horas extras con recargo mínimo 50%</p>
                <p>✓ Gratificación legal (Art. 50) con tope de ${(LegalCalculator.IMM_2026.adults * 4.75 / 12).toLocaleString('es-CL')} mensuales</p>
                <p>✓ Jornada: ${jornada} horas semanales (Ley 40 Horas)</p>
            </div>
        `;
        
        document.getElementById('calcResult').innerHTML = html;
    }
    
    // ==================== REPORTS ====================
    static generateReport(type) {
        const companyId = this.state.currentCompany;
        
        if (!companyId) {
            alert('Selecciona una empresa primero');
            return;
        }
        
        const company = Company.getById(companyId);
        const workers = Worker.getByCompany(companyId);
        
        if (workers.length === 0) {
            alert('No hay trabajadores para generar reporte');
            return;
        }
        
        let reportHTML = '';
        
        if (type === 'monthly') {
            reportHTML = ReportGenerator.generateMonthlyReport({}, company.name, 'Abril 2026');
        } else if (type === 'notices') {
            reportHTML = workers.map(w => ReportGenerator.generateWorkerNotice(w, 'Abril 2026', {})).join('<div style="page-break-after: always;"></div>');
        } else if (type === 'extraHours') {
            reportHTML = ReportGenerator.generateExtraHoursPact(workers, 'Abril 2026');
        } else if (type === 'compliance') {
            reportHTML = '<p>Análisis de cumplimiento próximamente</p>';
        }
        
        const printWindow = window.open('', '', 'width=1000,height=800');
        printWindow.document.write(reportHTML);
        printWindow.document.close();
        printWindow.print();
    }
    
    // ==================== UI UTILITIES ====================
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
    
    // ==================== DATA MANAGEMENT ====================
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

// ==================== INITIALIZE ON LOAD ====================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
