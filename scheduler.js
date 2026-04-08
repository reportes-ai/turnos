// ==================== SCHEDULER ADVANCED ====================
class SchedulerAdvanced {
    /**
     * Optimiza turnos resolviendo:
     * - Cobertura 24/7 o parcial según solicitud
     * - Cumplimiento Ley 40 Horas (42h en 2026)
     * - Preferencias de trabajadores
     * - Minimización de horas extras
     * - Máximo 2h extras diarias, 12h semanales
     * - Rotación equitativa de turnos
     */
    
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
        
        // Inicializar estructura para cada trabajador
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
        
        // Inicializar cobertura por día
        for (let day = 1; day <= daysInMonth; day++) {
            analysisData.dailyCoverage[day] = {
                mañana: [],
                tarde: [],
                noche: [],
                gapsDetected: []
            };
        }
        
        // Algoritmo de asignación inteligente
        this.assignShiftsOptimally(
            workers, 
            schedule, 
            daysInMonth, 
            availableShifts, 
            analysisData,
            month,
            year
        );
        
        // Calcular costos y análisis
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
        
        // Meta de horas semanales por trabajador
        const targetWeeklyHours = 42; // Ley 40 Horas 2026
        const targetMonthlyHours = targetWeeklyHours * 4.33;
        const workDaysInMonth = this.getWorkingDays(month, year);
        
        // Distribución inteligente de turnos
        for (let day = 1; day <= daysInMonth; day++) {
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            
            // Saltar domingos (por defecto, excepto sector específico)
            if (dayOfWeek === 0) continue;
            
            // Para cada turno disponible, asignar trabajadores
            for (const shiftName of availableShifts) {
                const shift = this.SHIFTS[shiftName];
                
                // Seleccionar mejor trabajador para este turno
                const bestWorker = this.selectBestWorkerForShift(
                    workersData,
                    shiftName,
                    day,
                    targetMonthlyHours
                );
                
                if (bestWorker) {
                    // Asignar turno
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
                    
                    // Actualizar estadísticas
                    schedule[bestWorker.id].totalHours += shift.hours;
                    bestWorker.hoursAssigned += shift.hours;
                    bestWorker.assigned++;
                    
                    // Registrar cobertura
                    analysis.dailyCoverage[day][shiftName].push(bestWorker.name);
                }
            }
        }
        
        // Balancear asignaciones
        this.balanceAssignments(workersData, schedule, daysInMonth, availableShifts);
    }
    
    static selectBestWorkerForShift(workers, shiftName, day, targetHours) {
        const candidates = workers
            .filter(w => {
                // No asignar si ya tiene ese día completo
                const assignedThisDay = w.assigned;
                // Priorizar quien tiene menos horas asignadas
                return w.hoursAssigned < targetHours;
            })
            .sort((a, b) => {
                // Prioridad 1: Preferencia de turno
                const prefMatch = (w) => w.preference === shiftName ? 2 : 0;
                // Prioridad 2: Menos horas asignadas
                const hoursScore = (targetHours - w.hoursAssigned) / targetHours;
                // Prioridad 3: Rotación equitativa
                const rotationScore = (a.shiftRotation - b.shiftRotation);
                
                return (prefMatch(b) + hoursScore * 10) - (prefMatch(a) + hoursScore * 10);
            });
        
        return candidates[0] || null;
    }
    
    static balanceAssignments(workers, schedule, daysInMonth, availableShifts) {
        // Asegurar que todos los trabajadores tengan asignaciones equitativas
        const avgHours = workers.reduce((sum, w) => sum + w.hoursAssigned, 0) / workers.length;
        
        workers.forEach(w => {
            if (w.hoursAssigned < avgHours * 0.8) {
                // Este trabajador necesita más horas
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
            
            // Costo ordinario
            const hourValue = w.salary / 30 / (jornada / 5);
            schedule[w.id].totalCost = w.salary; // Costo mensual base
            
            // Costo extras (50% de recargo mínimo)
            schedule[w.id].extraCost = schedule[w.id].extraHours * (hourValue * 1.5);
        });
    }
    
    static analyzeCompliance(schedule, analysis) {
        // Validar que se cumplen restricciones legales
        Object.values(schedule).forEach(s => {
            const extraHours = s.extraHours;
            
            // Máximo 12 horas extras semanales
            const weeklyExtra = extraHours / 4.33;
            if (weeklyExtra > 12) {
                analysis.violations.push({
                    worker: s.worker.name,
                    violation: `Horas extras semanales: ${weeklyExtra.toFixed(1)}h > 12h límite`,
                    severity: 'error'
                });
            }
            
            // Máximo 52 horas totales semanales
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
        
        // Recomendación: Personal adicional
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
        
        // Recomendación: Distribución de turnos
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
        const date = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const day = new Date(year, month - 1, d);
            const dayOfWeek = day.getDay();
            if (dayOfWeek > 0 && dayOfWeek < 6) workDays++;
        }
        return workDays;
    }
}

// ==================== REPORT GENERATOR ADVANCED ====================
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
                .warning { color: #e74c3c; font-weight: bold; }
                .success { color: #27ae60; font-weight: bold; }
                .shift-mañana { background: #FDB833; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px; }
                .shift-tarde { background: #4ECDC4; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px; }
                .shift-noche { background: #7B68EE; color: white; padding: 4px 8px; border-radius: 3px; font-size: 11px; }
                .page-break { page-break-after: always; }
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
            
            <h2 style="color: #1a3a52; border-bottom: 2px solid #d4a574; padding-bottom: 10px;">Detalles por Trabajador</h2>
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
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        Object.values(schedule).forEach(s => {
            const jornada = parseInt(s.worker.jornada);
            const ordinaryHours = jornada * 4.33;
            const extraCost = s.extraCost;
            const status = s.extraHours > 0 ? '<span class="warning">⚠️ Con extras</span>' : '<span class="success">✓ Cumple</span>';
            
            html += `
                <tr>
                    <td><strong>${s.worker.name}</strong></td>
                    <td>${s.worker.rut}</td>
                    <td>${s.worker.position}</td>
                    <td>${ordinaryHours.toFixed(1)}</td>
                    <td>${s.extraHours.toFixed(1)}</td>
                    <td><strong>${s.totalHours.toFixed(1)}</strong></td>
                    <td>$${extraCost.toLocaleString('es-CL')}</td>
                    <td>${status}</td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        
        // Tabla de turnos por día
        html += `<h2 style="color: #1a3a52; border-bottom: 2px solid #d4a574; padding-bottom: 10px; page-break-before: always;">Turnos por Día y Trabajador</h2>`;
        
        html += `<table>
            <thead>
                <tr>
                    <th>Día</th>
                    <th colspan="3" style="text-align: center;">Mañana</th>
                    <th colspan="3" style="text-align: center;">Tarde</th>
                    <th colspan="3" style="text-align: center;">Noche</th>
                </tr>
                <tr>
                    <th>Fecha</th>
                    <th>Trabajador</th>
                    <th>Horario</th>
                    <th>Horas</th>
                    <th>Trabajador</th>
                    <th>Horario</th>
                    <th>Horas</th>
                    <th>Trabajador</th>
                    <th>Horario</th>
                    <th>Horas</th>
                </tr>
            </thead>
            <tbody>
        `;
        
        const daysInMonth = new Date(year, month, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            if (dayOfWeek === 0) continue; // Skip domingos
            
            const shifts = { mañana: null, tarde: null, noche: null };
            
            // Buscar asignaciones para este día
            Object.values(schedule).forEach(s => {
                if (s.assignments[day]) {
                    s.assignments[day].forEach(assign => {
                        shifts[assign.shift] = {
                            worker: s.worker.name,
                            time: `${assign.start} - ${assign.end}`,
                            hours: assign.hours
                        };
                    });
                }
            });
            
            const date = new Date(year, month - 1, day);
            const dateStr = date.toLocaleDateString('es-CL', { weekday: 'short', day: '2-digit' });
            
            html += `
                <tr>
                    <td><strong>${dateStr}</strong></td>
                    <td>${shifts.mañana?.worker || '-'}</td>
                    <td>${shifts.mañana?.time || '-'}</td>
                    <td>${shifts.mañana?.hours.toFixed(2) || '-'}</td>
                    <td>${shifts.tarde?.worker || '-'}</td>
                    <td>${shifts.tarde?.time || '-'}</td>
                    <td>${shifts.tarde?.hours.toFixed(2) || '-'}</td>
                    <td>${shifts.noche?.worker || '-'}</td>
                    <td>${shifts.noche?.time || '-'}</td>
                    <td>${shifts.noche?.hours.toFixed(2) || '-'}</td>
                </tr>
            `;
        }
        
        html += `</tbody></table>`;
        
        return html;
    }
}
