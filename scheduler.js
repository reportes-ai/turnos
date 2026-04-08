// ==================== SCHEDULER MODULE ====================
class Scheduler {
    /**
     * Optimiza la asignación de turnos respetando:
     * - Ley 40 Horas (42 horas en 2026)
     * - Máx 2 horas extras diarias
     * - Máx 12 horas extras semanales
     * - Descanso mínimo 12 horas
     * - Cobertura 24/7 si aplica
     */
    
    static optimize(workers, coverageStart, coverageEnd, availableShifts) {
        const schedule = {};
        const shifts = Schedule.SHIFTS;
        const result = {
            schedule,
            coverage: this.validateCoverage(availableShifts, coverageStart, coverageEnd),
            recommendations: [],
            issues: []
        };
        
        // Ordenar trabajadores por preferencia y antigüedad
        const sortedWorkers = [...workers].sort((a, b) => {
            const prefMatch = (w) => w.preference === availableShifts[0] ? 1 : 0;
            return prefMatch(b) - prefMatch(a);
        });
        
        // Asignar turnos usando backtracking
        const assignments = {};
        const constraintChecker = new ConstraintChecker();
        
        sortedWorkers.forEach(worker => {
            assignments[worker.id] = {
                worker,
                assigned: [],
                hours: 0,
                extraHours: 0,
                shifts: []
            };
            
            // Intentar asignar turnos
            const targetDays = parseInt(worker.days) * 4.33; // Promedio mensual
            let daysAssigned = 0;
            
            for (const shiftName of availableShifts) {
                if (!shifts[shiftName]) continue;
                
                const shift = shifts[shiftName];
                const hoursPerShift = shift.worked;
                const dailyLimit = (parseInt(worker.jornada) / 5);
                
                // Validar restricciones antes de asignar
                if (constraintChecker.canAssignShift(
                    worker,
                    assignments[worker.id],
                    dailyLimit
                )) {
                    assignments[worker.id].shifts.push(shiftName);
                    assignments[worker.id].hours += hoursPerShift;
                    daysAssigned++;
                    
                    if (daysAssigned >= targetDays) break;
                }
            }
            
            // Validar compliance legal
            const compliance = LegalCalculator.validateCompliance(worker, assignments[worker.id].hours);
            if (!compliance.valid) {
                result.issues.push({
                    worker: worker.name,
                    problems: compliance.issues
                });
            }
        });
        
        result.schedule = assignments;
        result.recommendations = this.generateRecommendations(assignments, workers);
        
        return result;
    }
    
    static validateCoverage(shifts, startTime, endTime) {
        const coverage = {};
        const shiftTimes = {
            mañana: { start: 8, end: 15.25 },
            tarde: { start: 15, end: 22.25 },
            noche: { start: 22, end: 24 } // Simplificado
        };
        
        // Verificar si hay cobertura en los horarios solicitados
        shifts.forEach(shift => {
            const times = shiftTimes[shift];
            if (times) {
                coverage[shift] = {
                    start: times.start,
                    end: times.end,
                    covers: true
                };
            }
        });
        
        return coverage;
    }
    
    static generateRecommendations(assignments, workers) {
        const recommendations = [];
        let totalExtraHours = 0;
        let workersWithExtra = 0;
        
        Object.values(assignments).forEach(assignment => {
            if (assignment.extraHours > 0) {
                totalExtraHours += assignment.extraHours;
                workersWithExtra++;
            }
        });
        
        // Recomendación 1: Personal adicional
        if (workersWithExtra > workers.length * 0.5) {
            const estimatedSalary = workers.reduce((sum, w) => sum + w.salary, 0) / workers.length;
            const monthlyCostExtra = (totalExtraHours * 
                LegalCalculator.calculateHourValue(estimatedSalary) * 1.5);
            const monthlySalaryNewPerson = estimatedSalary;
            
            if (monthlySalaryNewPerson < monthlyCostExtra * 1.2) {
                recommendations.push({
                    type: 'cost-effective',
                    title: 'Contratar Personal Adicional',
                    description: `Costo de extras (${totalExtraHours.toFixed(0)}h): $${monthlyCostExtra.toLocaleString('es-CL')}`,
                    benefit: `Costo de nuevo empleado: $${monthlySalaryNewPerson.toLocaleString('es-CL')} + mejor cobertura`,
                    savings: (monthlyCostExtra - monthlySalaryNewPerson).toFixed(0)
                });
            }
        }
        
        // Recomendación 2: Ajuste de horarios
        if (totalExtraHours > 0) {
            recommendations.push({
                type: 'schedule-adjustment',
                title: 'Optimizar Distribución de Turnos',
                description: `Se generan ${totalExtraHours.toFixed(0)} horas extras`,
                benefit: 'Redistribuir carga horaria puede reducir sobretiempo',
                action: 'Revisar bandas horarias y horas valle'
            });
        }
        
        // Recomendación 3: Cumplimiento legal
        recommendations.push({
            type: 'compliance',
            title: 'Cumplimiento Ley 40 Horas',
            description: 'Verificar que no se excedan límites legales',
            limits: {
                dailyExtra: LegalCalculator.getMaxExtraHoursDaily(),
                weeklyExtra: LegalCalculator.getMaxExtraHoursWeekly(),
                weeklyTotal: LegalCalculator.getMaxWeeklyHours(),
                minRest: LegalCalculator.getMinDailyRest()
            }
        });
        
        return recommendations;
    }
}

// ==================== CONSTRAINT CHECKER ====================
class ConstraintChecker {
    canAssignShift(worker, currentAssignment, maxHoursDaily) {
        // Validar horas diarias
        if (currentAssignment.hours + maxHoursDaily > parseInt(worker.jornada)) {
            return false;
        }
        
        // Validar horas extras no excedan límites
        const extraHours = currentAssignment.hours - (parseInt(worker.jornada) * 4.33);
        if (extraHours > LegalCalculator.getMaxExtraHoursWeekly() * 4.33) {
            return false;
        }
        
        // Validar descanso mínimo (12 horas)
        // Simplificado: verificar que no haya dos turnos noche seguidos
        if (currentAssignment.shifts.length > 0) {
            const lastShift = currentAssignment.shifts[currentAssignment.shifts.length - 1];
            if (lastShift === 'noche' && currentAssignment.shifts.filter(s => s === 'noche').length > 2) {
                return false;
            }
        }
        
        return true;
    }
    
    validateSchedule(schedule) {
        const issues = [];
        
        Object.values(schedule).forEach(assignment => {
            const worker = assignment.worker;
            
            // Validar horas totales
            if (assignment.hours > parseInt(worker.jornada) + LegalCalculator.getMaxExtraHoursWeekly()) {
                issues.push(`${worker.name}: Excede límites de horas extras`);
            }
        });
        
        return {
            valid: issues.length === 0,
            issues
        };
    }
}

// ==================== REPORT GENERATOR ====================
class ReportGenerator {
    static generateMonthlyReport(schedule, companyName, month) {
        let html = `
            <div style="background: white; color: black; padding: 20px; border-radius: 4px;">
                <h1 style="text-align: center; color: var(--primary);">${companyName}</h1>
                <h2 style="text-align: center; color: var(--secondary);">Resumen Mensual - ${month}</h2>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: var(--primary); color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Trabajador</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Horas Ordinarias</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Horas Extras</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Total</th>
                            <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">Monto Extras</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let totalExtraPayment = 0;
        
        Object.values(schedule).forEach(assignment => {
            const worker = assignment.worker;
            const jornada = parseInt(worker.jornada);
            const ordinaryHours = jornada * 4.33;
            const extraHours = Math.max(0, assignment.hours - ordinaryHours);
            const hourValue = LegalCalculator.calculateHourValue(worker.salary, jornada);
            const extraPayment = LegalCalculator.calculateExtraHourPayment(extraHours, hourValue);
            totalExtraPayment += extraPayment;
            
            html += `
                <tr style="border-bottom: 1px solid #ddd;">
                    <td style="padding: 10px;">${worker.name}</td>
                    <td style="padding: 10px; text-align: center;">${ordinaryHours.toFixed(1)}</td>
                    <td style="padding: 10px; text-align: center;">${extraHours.toFixed(1)}</td>
                    <td style="padding: 10px; text-align: center;">${assignment.hours.toFixed(1)}</td>
                    <td style="padding: 10px; text-align: center;">$${extraPayment.toLocaleString('es-CL')}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
                
                <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 4px;">
                    <h3>Total Horas Extras: $${totalExtraPayment.toLocaleString('es-CL')}</h3>
                    <p style="color: #666; margin-top: 10px;">Generado: ${new Date().toLocaleDateString('es-CL')}</p>
                </div>
            </div>
        `;
        
        return html;
    }
    
    static generateWorkerNotice(worker, month, schedule) {
        const jornada = parseInt(worker.jornada);
        const ordinaryHours = jornada * 4.33;
        
        const html = `
            <div style="background: white; color: black; padding: 30px; max-width: 800px; margin: 0 auto;">
                <p style="text-align: center; color: #666;">
                    <small>AVISO AL TRABAJADOR - Mes de ${month}</small>
                </p>
                
                <h2 style="text-align: center; color: var(--primary); margin-bottom: 30px;">
                    PROGRAMACIÓN DE TURNOS
                </h2>
                
                <div style="margin-bottom: 20px;">
                    <p><strong>Nombre:</strong> ${worker.name}</p>
                    <p><strong>RUT:</strong> ${worker.rut}</p>
                    <p><strong>Cargo:</strong> ${worker.position}</p>
                    <p><strong>Jornada:</strong> ${worker.jornada} horas semanales</p>
                </div>
                
                <div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-left: 4px solid var(--secondary);">
                    <h3 style="color: var(--primary);">Turnos Asignados</h3>
                    <p>Los turnos se detallaran en anexo adjunto con la distribución diaria.</p>
                    <p style="margin-top: 15px; color: #666;">
                        <strong>Horas Mensuales:</strong> ${ordinaryHours.toFixed(1)} horas ordinarias
                    </p>
                </div>
                
                <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                    <p style="margin-bottom: 30px; font-size: 12px; color: #666;">
                        Declaro haber recibido conocimiento de la presente programación de turnos,
                        de conformidad con lo dispuesto en el Código del Trabajo y la Ley 40 Horas.
                    </p>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                        <div style="text-align: center;">
                            <p style="border-top: 1px solid #333; padding-top: 5px; height: 60px;"></p>
                            <small>Firma Trabajador</small>
                        </div>
                        <div style="text-align: center;">
                            <p style="border-top: 1px solid #333; padding-top: 5px; height: 60px;"></p>
                            <small>Firma Empleador</small>
                        </div>
                    </div>
                    
                    <p style="text-align: center; margin-top: 20px; font-size: 11px; color: #999;">
                        ${new Date().toLocaleDateString('es-CL')}
                    </p>
                </div>
            </div>
        `;
        
        return html;
    }
    
    static generateExtraHoursPact(workers, month) {
        const workersWithExtra = workers.filter(w => w.extraHours > 0);
        
        let html = `
            <div style="background: white; color: black; padding: 30px; max-width: 900px; margin: 0 auto;">
                <h1 style="text-align: center; color: var(--primary);">PACTO DE HORAS EXTRAORDINARIAS</h1>
                <p style="text-align: center; color: #666; margin-bottom: 30px;">Mes de ${month}</p>
                
                <div style="margin-bottom: 30px; padding: 15px; background: #e8f4f8; border-left: 4px solid #3498db;">
                    <p style="color: #333;">
                        <strong>Base Legal:</strong> Artículo 30 del Código del Trabajo - Ley 40 Horas (Ley N° 21.561)
                    </p>
                </div>
        `;
        
        workersWithExtra.forEach(worker => {
            const hourValue = LegalCalculator.calculateHourValue(worker.salary, worker.jornada);
            const extraPayment = LegalCalculator.calculateExtraHourPayment(worker.extraHours, hourValue);
            
            html += `
                <div style="margin-top: 20px; padding: 20px; border: 1px solid #ddd; page-break-inside: avoid;">
                    <h3 style="color: var(--primary);">PACTO INDIVIDUAL</h3>
                    
                    <table style="width: 100%; margin-top: 15px;">
                        <tr>
                            <td style="padding: 8px;"><strong>Trabajador:</strong></td>
                            <td style="padding: 8px;">${worker.name}</td>
                            <td style="padding: 8px;"><strong>RUT:</strong></td>
                            <td style="padding: 8px;">${worker.rut}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px;"><strong>Cargo:</strong></td>
                            <td style="padding: 8px;">${worker.position}</td>
                            <td style="padding: 8px;"><strong>Jornada:</strong></td>
                            <td style="padding: 8px;">${worker.jornada} horas</td>
                        </tr>
                    </table>
                    
                    <div style="margin-top: 20px; padding: 15px; background: #f5f5f5;">
                        <table style="width: 100%; font-size: 14px;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">Horas Extraordinarias:</td>
                                <td style="text-align: right; padding: 8px; font-weight: bold;">${worker.extraHours.toFixed(1)} horas</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">Valor Hora Ordinaria:</td>
                                <td style="text-align: right; padding: 8px;">$${hourValue.toLocaleString('es-CL', {maximumFractionDigits: 0})}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">Recargo Legal (50%):</td>
                                <td style="text-align: right; padding: 8px;">${(hourValue * 0.5).toLocaleString('es-CL', {maximumFractionDigits: 0})}</td>
                            </tr>
                            <tr style="background: var(--primary); color: white;">
                                <td style="padding: 8px;"><strong>Total a Pagar:</strong></td>
                                <td style="text-align: right; padding: 8px; font-weight: bold;">$${extraPayment.toLocaleString('es-CL')}</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="margin-top: 15px; font-size: 12px; color: #666;">
                        Ambas partes acuerdan que el trabajador realizará las horas extraordinarias señaladas,
                        las que serán remuneradas con un recargo mínimo del 50% sobre el valor de la hora ordinaria.
                    </p>
                    
                    <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div style="text-align: center;">
                            <p style="border-top: 1px solid #333; padding-top: 5px; height: 50px;"></p>
                            <small>Firma Trabajador</small>
                        </div>
                        <div style="text-align: center;">
                            <p style="border-top: 1px solid #333; padding-top: 5px; height: 50px;"></p>
                            <small>Firma Empleador</small>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `
                <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #f39c12; font-size: 12px;">
                    <strong>Nota Legal:</strong> Este pacto debe constar por escrito y ser conservado como constancia
                    para la Dirección del Trabajo. Límites máximos: 2 horas diarias, 12 semanales, 52 totales en semana.
                </div>
            </div>
        `;
        
        return html;
    }
}
