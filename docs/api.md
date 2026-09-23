# API-контракты Halyk TalentOS

Все пути ниже начинаются с `/api`. Контроллеры используют стандартные Web Request / Response; адаптер Next.js только направляет вызов в backend. Ответы — JSON с `Cache-Control: no-store`. Общие DTO: `packages/shared/types`; схемы входных данных: `packages/shared/schemas`.

## Сессия и область доступа

| Метод и путь | Запрос                                | Результат                                                       |
| ------------ | ------------------------------------- | --------------------------------------------------------------- |
| POST /login  | `{"role":"EMPLOYEE"}`, MANAGER или HR | HttpOnly-cookie; сервер выбирает демонстрационного пользователя |
| GET /session | Cookie                                | Сессия; без действительного cookie — 401                                                 |
| POST /logout | Cookie                                | Удаление cookie                                                 |

Для POST нужен Origin текущего приложения. В демовходе запрещены дополнительные поля: employeeId, actorId или команда не принимаются. Персональные API проверяют область сотрудника через централизованную авторизацию. Manager получает подразделения из ManagerTeam; HR имеет область всей демонстрационной организации.

## Сотрудник

| Метод и путь                                        | Запрос / ответ                                                                    | Доступ                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| GET /employees/:id/dashboard                        | Snapshot: профиль, готовые careerViews, рекомендации, навыки, access              | Сам сотрудник, его Manager, HR               |
| GET /employees/:id/recommendations                  | `{employeeId,recommendations}`; score, факторы и причины внутри каждого Candidate | Та же область                                |
| GET /employees/:id/skills                           | `{skills,evidence}`; уровни, требования, gap и подтверждения                      | Та же область                                |
| POST /employees/:id/target                          | `{role,grade}` → Snapshot                                                         | Сам сотрудник                                |
| POST /employees/:id/activities/:activityId/start    | Без тела → ActivityWorkspace                                                      | Сам сотрудник                                |
| POST /employees/:id/activities/:activityId/complete | Без тела → ActivityWorkspace                                                      | Сам сотрудник                                |
| GET /learning/:activityId                           | ActivityWorkspace, скрытые ключи тестов удалены                                   | Сотрудник                                    |
| POST /learning/:activityId/unit                     | `{unitId,action,submission?,answers?}` → ActivityWorkspace                        | Сотрудник                                    |
| GET /explanation?eventId=EV017                      | Проверенное объяснение с source; возможны targetRole / targetGrade                | Своя область; Manager/HR передают employeeId |
| GET /evidence                                       | Массив SkillEvidenceView                                                          | Своя область; Manager/HR передают employeeId |
| GET /learning-catalog                               | Метаданные учебных траекторий                                                     | Все вошедшие роли                            |

Действия модуля: start, complete, submit, skip. answers — отображение ID вопроса в индекс выбранного ответа. submission — письменная работа. Поля score и employeeId в теле запрещены.

Сохранены совместимые пути прежнего UI: GET /me, POST /target, POST /learning/start с `{activityId}`, POST /learning/:activityId/verify, POST /activity с `{eventId,status}`. Прямой status=COMPLETED через прежний API отклоняется: завершение проходит проверку mastery и evidence.

## Руководитель

| Метод и путь               | Контракт                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| GET /manager/team          | `{departments,workforce,development}`, все данные ограничены командой |
| GET /manager/employees/:id | Snapshot сотрудника своей команды, access.canEdit=false               |
| POST /manager/validate     | `{enrollmentId,approved,comment?}` → обновлённая команда              |

Проверка чужого enrollment завершается 403. Согласование не начисляет уровень само по себе: сотрудник завершает траекторию после выполнения всех условий.

## HR

| Метод и путь                 | Контракт                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET /hr/overview             | Workforce: готовые метрики, дефициты, сотрудники, агрегаты                                               |
| GET /hr/skill-gaps           | Дефициты навыков                                                                                         |
| GET /hr/learning-roi         | skillsDeveloped, averageTimeToMasteryMinutes, completionRate, financialROI=null и объяснение ограничения |
| POST /hr/scenario            | `{skillId,needed,months}` → непересекающиеся группы и проценты                                           |
| GET /hr/development          | DevelopmentReport с траекториями и очередью согласований                                                 |
| POST /hr/development/draft   | `{skillId,fromLevel,toLevel,audience,title?}` → черновик                                                 |
| POST /hr/development/save    | `{draft}` → `{activityId,pathId}`                                                                        |
| POST /hr/development/approve | `{enrollmentId,approved,comment?}` → DevelopmentReport                                                   |
| POST /hr/import              | multipart/form-data, 1–5 файлов в поле files → counts и results                                          |
| GET /hr/audit                | Последние 100 AuditEvent с разобранными metadata                                                         |

Совместимые пути: GET /hr и GET /hr/employee?id=EMP001. Сценарий: needed — целое 1–10000, months — целое 3–12. Финансовый ROI отсутствует: затраты и причинный эффект обучения не собираются.

## Ошибки

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "This employee is outside your team."
  }
}
```

| HTTP | code                           | Смысл                                                        |
| ---- | ------------------------------ | ------------------------------------------------------------ |
| 400  | VALIDATION_ERROR               | Неверный JSON, поля, типы или импорт                         |
| 400  | BUSINESS_RULE_VIOLATION        | Не выполнены условия обучения или другая предметная проверка |
| 401  | UNAUTHENTICATED                | Сессия отсутствует, истекла или подпись неверна              |
| 403  | FORBIDDEN                      | Нет разрешения / вне команды                                 |
| 404  | NOT_FOUND / EMPLOYEE_NOT_FOUND | Ресурс отсутствует                                           |
| 409  | CONFLICT                       | Конфликт уникальных идентификаторов                          |
| 413  | PAYLOAD_TOO_LARGE              | Превышен предел запроса                                      |
| 500  | INTERNAL_ERROR                 | Неожиданная ошибка; внутренние детали не передаются          |

ValidationError может включать details с путём поля. Сырой ответ ORM или провайдера никогда не является клиентским контрактом.

## Быстрая проверка

При запущенном сервере, в Bash либо с curl.exe в PowerShell:

```bash
curl -c session.cookies -H "Origin: http://127.0.0.1:3000" -H "Content-Type: application/json" -d '{"role":"EMPLOYEE"}' http://127.0.0.1:3000/api/login
curl -b session.cookies http://127.0.0.1:3000/api/employees/EMP001/dashboard
curl -b session.cookies http://127.0.0.1:3000/api/hr/overview
```

Последний запрос должен вернуть 403. Для автоматической проверки трёх ролей, SSR-страниц и защиты учебных действий: `npm run test:http`. Cookie-файл содержит временную сессию и не должен попадать в Git.
