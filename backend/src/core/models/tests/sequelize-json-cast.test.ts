import { DataTypes, Model, ModelStatic, Op, Sequelize } from 'sequelize'

// Regression test for CVE-2026-30951 / GHSA-6457-6jrx-69cr (RAY-10):
// sequelize < 6.37.8 interpolated the `::type` suffix of a JSON where key
// unescaped into CAST(... AS <type>).
describe('sequelize JSON where cast type', () => {
  const sequelize = new Sequelize({ dialect: 'postgres', logging: false })
  const JsonModel: ModelStatic<Model> = sequelize.define('json_model', {
    params: DataTypes.JSONB,
  })
  const queryGenerator = (sequelize.getQueryInterface() as any).queryGenerator

  const whereSql = (where: Record<string, unknown>): string =>
    queryGenerator.whereQuery(where, { model: JsonModel })

  afterAll(async () => {
    await sequelize.close()
  })

  test('rejects an injected cast type in a JSON path key', () => {
    expect(() =>
      whereSql({ params: { 'recipient_name::text) OR 1=1 --': 'x' } })
    ).toThrow('Invalid cast type')
  })

  test('still allows standard cast types', () => {
    expect(whereSql({ params: { 'count::integer': 1 } })).toContain(
      'AS INTEGER'
    )
  })

  test('JSON path search on params is unaffected', () => {
    const sql = whereSql({
      params: { recipient_name: { [Op.iLike]: '%alice%' } },
    })
    expect(sql).toContain('"params"#>>\'{recipient_name}\'')
    expect(sql).toContain("ILIKE '%alice%'")
  })
})
