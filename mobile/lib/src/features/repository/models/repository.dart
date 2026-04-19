/// 仓库模型
class Repository {
  final String id;
  final String name;
  final String code;
  final String? description;
  final String? companyCode;
  final String storageType;
  final String storagePath;
  final bool versionEnabled;
  final int? maxVersions;
  final bool encryptEnabled;
  final String? encryptAlgorithm;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;

  Repository({
    required this.id,
    required this.name,
    required this.code,
    this.description,
    this.companyCode,
    required this.storageType,
    required this.storagePath,
    required this.versionEnabled,
    this.maxVersions,
    required this.encryptEnabled,
    this.encryptAlgorithm,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Repository.fromJson(Map<String, dynamic> json) {
    return Repository(
      id: json['id'],
      name: json['name'] ?? '',
      code: json['code'] ?? '',
      description: json['description'],
      companyCode: json['companyCode'],
      storageType: json['storageType'] ?? 'local',
      storagePath: json['storagePath'] ?? '',
      versionEnabled: json['versionEnabled'] ?? false,
      maxVersions: json['maxVersions'],
      encryptEnabled: json['encryptEnabled'] ?? false,
      encryptAlgorithm: json['encryptAlgorithm'],
      status: json['status'] ?? 'active',
      createdAt: DateTime.parse(json['createdAt']),
      updatedAt: DateTime.parse(json['updatedAt']),
    );
  }
}
